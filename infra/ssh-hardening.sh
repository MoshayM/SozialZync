#!/usr/bin/env bash
# =============================================================================
# SSH Hardening Script — AI CreatorForce / Sozialzync
# Applies to: bastion hosts, Kubernetes nodes, self-hosted infra.
# Railway PaaS containers: Railway manages SSH access — this script does not
# apply to Railway-hosted services. Use it for VMs, bare-metal, or k8s nodes.
#
# Run as root. Test in a second terminal BEFORE closing the current session.
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    echo -e "${RED}ERROR: run this script as root (sudo ./ssh-hardening.sh)${NC}" >&2
    exit 1
  fi
}

require_root

echo -e "${YELLOW}[1/6] Backing up current sshd_config…${NC}"
cp /etc/ssh/sshd_config "/etc/ssh/sshd_config.bak.$(date +%Y%m%d%H%M%S)"

echo -e "${YELLOW}[2/6] Writing drop-in hardening config…${NC}"
mkdir -p /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/99-creatorforce-hardening.conf << 'SSHCONF'
# =============================================================================
# SSH hardening — CreatorForce / Sozialzync (OWASP A05, A07)
# =============================================================================

# Disable root login entirely (use a non-root user with sudo)
PermitRootLogin no

# Key-based auth only — disable all password methods
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
UsePAM yes

# Only allow specific OS users to SSH (add the actual deploy user here)
# AllowUsers deploy-user  # uncomment and set before applying

# Modern key exchange algorithms only (disable DH groups < 3072-bit)
KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org,diffie-hellman-group16-sha512,diffie-hellman-group18-sha512,ecdh-sha2-nistp521

# Strong symmetric ciphers
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr

# Strong MACs — ETM (encrypt-then-MAC) only
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com

# Session hardening
LoginGraceTime 20
MaxAuthTries 3
MaxSessions 5
MaxStartups 5:30:10

# Disconnect idle sessions after 10 minutes of inactivity
ClientAliveInterval 300
ClientAliveCountMax 2

# Disable unused features that expand attack surface
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
PermitTunnel no
GatewayPorts no

# Restrict SSH protocol to version 2
Protocol 2

# Log authentication at verbose level for audit trail (OWASP A09)
LogLevel VERBOSE
SyslogFacility AUTH

# Disable user environment variables (prevent PATH manipulation)
PermitUserEnvironment no

# Prevent host-based auth
HostbasedAuthentication no
IgnoreRhosts yes

# Banner shown before login (legal notice)
Banner /etc/ssh/banner.txt
SSHCONF

echo -e "${YELLOW}[3/6] Writing login banner…${NC}"
cat > /etc/ssh/banner.txt << 'BANNER'
*******************************************************************************
WARNING: This system is for authorized use only.
All access is logged and monitored. Unauthorized access is prohibited
and may result in civil and criminal penalties.
*******************************************************************************
BANNER

echo -e "${YELLOW}[4/6] Validating config…${NC}"
sshd -t && echo -e "${GREEN}  Config valid.${NC}" || {
  echo -e "${RED}  Config invalid — reverting to backup.${NC}"
  cp "/etc/ssh/sshd_config.bak."* /etc/ssh/sshd_config 2>/dev/null | tail -1
  exit 1
}

echo -e "${YELLOW}[5/6] Reloading sshd…${NC}"
if systemctl is-active --quiet sshd; then
  systemctl reload sshd
elif systemctl is-active --quiet ssh; then
  systemctl reload ssh
else
  echo -e "${RED}  sshd is not running — start it manually after reviewing the config.${NC}"
fi

echo -e "${YELLOW}[6/6] Installing fail2ban (if not present)…${NC}"
if ! command -v fail2ban-server &>/dev/null; then
  apt-get update -qq && apt-get install -y -qq fail2ban
fi

# fail2ban SSH jail
cat > /etc/fail2ban/jail.d/sshd-creatorforce.conf << 'F2B'
[sshd]
enabled  = true
port     = ssh
filter   = sshd
backend  = systemd
maxretry = 3
findtime = 600
bantime  = 3600
ignoreip = 127.0.0.1/8 ::1
F2B

systemctl enable fail2ban --now
systemctl reload fail2ban 2>/dev/null || systemctl restart fail2ban

echo -e "${GREEN}
=============================================================================
SSH hardening complete. NEXT STEPS (do these NOW in a separate terminal):
  1. Confirm your SSH key is in ~/.ssh/authorized_keys for the deploy user
  2. Test login: ssh -i ~/.ssh/id_ed25519 <user>@<host>
  3. If login fails, restore: cp /etc/ssh/sshd_config.bak.* /etc/ssh/sshd_config
  4. Uncomment and set AllowUsers in 99-creatorforce-hardening.conf
  5. fail2ban status: fail2ban-client status sshd
=============================================================================
${NC}"
