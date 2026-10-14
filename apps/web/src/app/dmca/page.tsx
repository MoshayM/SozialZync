import Link from 'next/link';

export const metadata = {
  title: 'DMCA Policy | SozialZynk',
  description: 'Digital Millennium Copyright Act (DMCA) policy and takedown procedure for SozialZynk.',
};

export default function DmcaPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">DMCA Copyright Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Effective: October 15, 2026</p>

        <div className="prose prose-gray max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-3">Overview</h2>
            <p className="text-gray-600 leading-relaxed">
              SozialZynk respects the intellectual property rights of others and expects its users to do the same. In accordance with the Digital Millennium Copyright Act of 1998 (17 U.S.C. § 512), we will respond expeditiously to claims of copyright infringement reported to our designated DMCA Agent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-3">Designated DMCA Agent</h2>
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <p className="font-semibold text-gray-800 mb-1">DMCA Agent — SozialZynk</p>
              <p className="text-gray-600 text-sm leading-relaxed">
                Email: <a href="mailto:dmca@sozialzync.com" className="text-blue-600 hover:underline">dmca@sozialzync.com</a><br />
                Mailing Address: SozialZynk Legal, IIMCAL AI, Joka, Kolkata 700104, India<br />
                Subject line: <span className="font-mono text-xs bg-gray-100 px-1 rounded">DMCA Takedown Request</span>
              </p>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Only DMCA notices should be sent to the above contact. Other communications will not receive a response at this address.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-3">Filing a DMCA Takedown Notice</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              To file a notice of copyright infringement with us, you must provide a written communication that includes all of the following elements (17 U.S.C. § 512(c)(3)):
            </p>
            <ol className="list-decimal list-outside pl-5 space-y-2 text-gray-600">
              <li>A physical or electronic signature of a person authorised to act on behalf of the owner of an exclusive right that is allegedly infringed.</li>
              <li>Identification of the copyrighted work claimed to have been infringed, or, if multiple copyrighted works at a single online site are covered by a single notification, a representative list of such works.</li>
              <li>Identification of the material that is claimed to be infringing or to be the subject of infringing activity and that is to be removed, including information sufficient for us to locate the material (e.g., a direct URL to the content).</li>
              <li>Information reasonably sufficient to permit us to contact you (name, address, telephone number, email address).</li>
              <li>A statement that you have a good-faith belief that use of the material in the manner complained of is not authorised by the copyright owner, its agent, or the law.</li>
              <li>A statement that the information in the notification is accurate, and under penalty of perjury, that you are authorised to act on behalf of the owner of an exclusive right that is allegedly infringed.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-3">Counter-Notification Procedure</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              If you believe your content was removed by mistake or misidentification, you may file a counter-notification. Your counter-notification must include (17 U.S.C. § 512(g)(3)):
            </p>
            <ol className="list-decimal list-outside pl-5 space-y-2 text-gray-600">
              <li>Your physical or electronic signature.</li>
              <li>Identification of the material that has been removed and the location at which it appeared before removal.</li>
              <li>A statement under penalty of perjury that you have a good-faith belief the material was removed due to mistake or misidentification.</li>
              <li>Your name, address, and telephone number, and a statement that you consent to the jurisdiction of the Federal District Court for the judicial district in which your address is located (or if outside the US, the courts of India), and that you will accept service of process from the claimant.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-3">Repeat Infringer Policy</h2>
            <p className="text-gray-600 leading-relaxed">
              In accordance with the DMCA and other applicable law, SozialZynk has adopted a policy of terminating, in appropriate circumstances, the accounts of users who are deemed to be repeat infringers. SozialZynk may also limit access or terminate accounts of any users who infringe any intellectual property rights of others, whether or not there is any repeat infringement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-3">Safe Harbour Notice</h2>
            <p className="text-gray-600 leading-relaxed">
              SozialZynk is a platform service provider as defined under 17 U.S.C. § 512(c). We do not monitor user-generated content for copyright compliance but respond promptly to valid DMCA notices. AI-generated content created using our platform remains the responsibility of the creator under our Terms of Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-3">Important Note on False Claims</h2>
            <p className="text-gray-600 leading-relaxed">
              Under 17 U.S.C. § 512(f), any person who knowingly materially misrepresents that material or activity is infringing, or that material was removed by mistake, may be held liable for damages, including costs and attorneys&apos; fees.
            </p>
          </section>

          <div className="pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Questions about this policy? See our{' '}
              <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
              {' '}or{' '}
              <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
