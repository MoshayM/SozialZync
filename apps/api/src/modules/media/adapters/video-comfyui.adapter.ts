import type { VideoGenerationAdapter, VideoRequest, GeneratedVideo, VideoAdapter, SceneVideoRequest, GeneratedMedia } from '../media.types';

const BASE_URL = process.env['COMFYUI_URL'] ?? 'http://localhost:8188';

/**
 * ComfyUI video adapter. Uses ComfyUI's /prompt API with an img2vid or txt2vid
 * workflow. Activates when COMFYUI_URL env is set.
 * Supports SVD (img2vid) and generic txt2vid via KSampler + VHS_VideoCombine.
 */
export class ComfyUIVideoAdapter implements VideoGenerationAdapter, VideoAdapter {
  readonly name = 'comfyui-video';

  available(): boolean {
    return !!process.env['COMFYUI_URL'];
  }

  async generate(req: VideoRequest): Promise<GeneratedVideo> {
    const clientId = `cfv_${Date.now()}`;
    const width = req.width ?? 1024;
    const height = req.height ?? 576;
    const fps = req.fps ?? 8;
    const durationSeconds = req.durationSeconds ?? 3;
    const frames = Math.round(fps * durationSeconds);
    const seed = req.seed ?? Math.floor(Math.random() * 2 ** 32);
    const motionScale = req.motionScale ?? 127;

    const workflow: Record<string, unknown> = req.referenceImageUrl
      ? this.buildImg2VidWorkflow(
          req.referenceImageUrl,
          width,
          height,
          frames,
          fps,
          seed,
          motionScale,
          req.steps ?? 20,
        )
      : this.buildTxt2VidWorkflow(
          req.prompt,
          req.negativePrompt ?? '',
          width,
          height,
          frames,
          fps,
          seed,
          req.steps ?? 20,
          req.cfgScale ?? 7,
          req.model ?? 'v2-1_512-ema-pruned.safetensors',
        );

    const queueResp = await fetch(`${BASE_URL}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow, client_id: clientId }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!queueResp.ok) {
      throw new Error(`ComfyUI video queue failed: ${queueResp.status}`);
    }
    const { prompt_id } = (await queueResp.json()) as { prompt_id: string };

    // Poll history — video generation takes longer than image (up to 10 min)
    const deadline = Date.now() + 600_000;
    while (Date.now() < deadline) {
      await new Promise<void>((r) => setTimeout(r, 3000));
      const histResp = await fetch(`${BASE_URL}/history/${prompt_id}`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!histResp.ok) continue;

      const hist = (await histResp.json()) as Record<
        string,
        {
          outputs?: Record<
            string,
            {
              gifs?: Array<{ filename: string; subfolder: string; type: string; format?: string }>;
              videos?: Array<{ filename: string; subfolder: string; type: string }>;
            }
          >;
        }
      >;

      const entry = hist[prompt_id];
      if (!entry?.outputs) continue;

      for (const nodeOut of Object.values(entry.outputs)) {
        const videoFiles = nodeOut.videos ?? nodeOut.gifs ?? [];
        if (!videoFiles.length) continue;

        const vid = videoFiles[0];
        const ext = vid.filename.endsWith('.mp4') ? 'mp4' : 'gif';
        const vidUrl = `${BASE_URL}/view?filename=${encodeURIComponent(vid.filename)}&subfolder=${encodeURIComponent(vid.subfolder)}&type=${vid.type}`;

        const vidResp = await fetch(vidUrl, { signal: AbortSignal.timeout(60_000) });
        if (!vidResp.ok) throw new Error(`ComfyUI video fetch failed: ${vidResp.status}`);

        const buffer = Buffer.from(await vidResp.arrayBuffer());
        return {
          buffer,
          mimeType: ext === 'mp4' ? 'video/mp4' : 'image/gif',
          width,
          height,
          durationSeconds,
          fps,
          provider: 'comfyui-video',
          model: req.model ?? 'comfyui-workflow',
          seed,
          prompt: req.prompt,
        };
      }
    }
    throw new Error('ComfyUI video generation timed out after 10 minutes');
  }

  async renderScene(req: SceneVideoRequest): Promise<GeneratedMedia> {
    const result = await this.generate({
      prompt: req.prompt,
      width: req.width ?? 1024,
      height: req.height ?? 576,
      durationSeconds: req.durationSecs,
      fps: 8,
      referenceImageUrl: req.imagePath,
    });
    return {
      buffer: result.buffer,
      mimeType: result.mimeType,
      ext: 'mp4',
      durationMs: result.durationSeconds * 1000,
      model: result.model,
      notes: `ComfyUI video ${result.width}×${result.height} @ ${result.fps}fps`,
    };
  }

  private buildTxt2VidWorkflow(
    prompt: string,
    negativePrompt: string,
    width: number,
    height: number,
    frames: number,
    fps: number,
    seed: number,
    steps: number,
    cfg: number,
    model: string,
  ): Record<string, unknown> {
    return {
      '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: model } },
      '2': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['1', 1] } },
      '3': { class_type: 'CLIPTextEncode', inputs: { text: negativePrompt, clip: ['1', 1] } },
      '4': { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: frames } },
      '5': {
        class_type: 'KSampler',
        inputs: {
          seed,
          steps,
          cfg,
          sampler_name: 'euler',
          scheduler: 'karras',
          denoise: 1,
          model: ['1', 0],
          positive: ['2', 0],
          negative: ['3', 0],
          latent_image: ['4', 0],
        },
      },
      '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
      '7': {
        class_type: 'VHS_VideoCombine',
        inputs: {
          images: ['6', 0],
          frame_rate: fps,
          loop_count: 0,
          filename_prefix: 'cf_vid',
          format: 'video/h264-mp4',
          save_output: false,
        },
      },
    };
  }

  private buildImg2VidWorkflow(
    imageUrl: string,
    width: number,
    height: number,
    frames: number,
    fps: number,
    seed: number,
    motionBucketId: number,
    steps: number,
  ): Record<string, unknown> {
    return {
      '1': {
        class_type: 'ImageOnlyCheckpointLoader',
        inputs: { ckpt_name: 'svd_xt_1_1.safetensors' },
      },
      '2': { class_type: 'LoadImageFromURL', inputs: { url: imageUrl } },
      '3': {
        class_type: 'ImageResize',
        inputs: { image: ['2', 0], width, height, method: 'lanczos' },
      },
      '4': {
        class_type: 'SVD_img2vid_Conditioning',
        inputs: {
          clip_vision: ['1', 1],
          init_image: ['3', 0],
          vae: ['1', 2],
          width,
          height,
          video_frames: frames,
          motion_bucket_id: motionBucketId,
          fps,
          augmentation_level: 0,
        },
      },
      '5': { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
      '6': {
        class_type: 'BasicScheduler',
        inputs: { model: ['1', 0], scheduler: 'karras', steps, denoise: 1 },
      },
      '7': {
        class_type: 'SamplerCustom',
        inputs: {
          model: ['1', 0],
          add_noise: true,
          noise_seed: seed,
          cfg: 2.5,
          positive: ['4', 0],
          negative: ['4', 1],
          sampler: ['5', 0],
          sigmas: ['6', 0],
          latent_image: ['4', 2],
        },
      },
      '8': { class_type: 'VAEDecodeVideo', inputs: { samples: ['7', 1], vae: ['1', 2] } },
      '9': {
        class_type: 'VHS_VideoCombine',
        inputs: {
          images: ['8', 0],
          frame_rate: fps,
          loop_count: 0,
          filename_prefix: 'cf_svd',
          format: 'video/h264-mp4',
          save_output: false,
        },
      },
    };
  }
}
