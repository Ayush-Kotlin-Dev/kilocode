<p align="center">
  <a href="https://github.com/ayush/pentAGI/stargazers"><img src="https://raster.shields.io/github/stars/ayush/pentAGI?style=flat&logo=github" alt="GitHub Stars"></a>
  <a href="https://github.com/ayush/pentAGI/blob/main/LICENSE"><img src="https://raster.shields.io/badge/License-MIT-green?style=flat" alt="MIT License"></a>
</p>

# 🐾 PentAGI

> PentAGI is an autonomous penetration testing platform built from a hardened fork of Kilo CLI. It combines agentic AI with offensive security tooling to automate reconnaissance, vulnerability analysis, exploitation, post-exploitation, and reporting on macOS.

- 🎯 **Automated Pentesting** -- Full PTES/OWASP methodology execution
- 🔓 **Exploit Development** -- Shellcode, ROP chains, buffer overflow workflows
- 🌐 **Active Directory Testing** -- Kerberoasting, DCSync, BloodHound path analysis
- 🛡️ **Red Team Operations** -- C2 frameworks, tunneling, credential attacks
- 📊 **Structured Reporting** -- CVSS scoring, MITRE ATT&CK mapping, anonymized reports
- 💻 **macOS Native** -- Built for Darwin, uses Homebrew for tool management
- 🤖 **AI-Powered** -- Uses OpenAI & Kilo Gateway models for intelligent decision-making

## Quick Start

### Prerequisites

- macOS (Darwin)
- [Bun](https://bun.sh) runtime
- [Homebrew](https://brew.sh) for security tool installation

### Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Clone & Run

```bash
git clone https://github.com/Ayush-Kotlin-Dev/kilocode.git
cd kilocode
bun install
bun run dev
```

Then run `kilo` in any project directory to start the PentAGI TUI.

### Quick Install (curl)

Once a release is published, install with one command:

```bash
curl -fsSL https://raw.githubusercontent.com/Ayush-Kotlin-Dev/kilocode/main/install | bash
```

This downloads the latest release binary to `~/.kilo/bin/kilo` and adds it to your PATH.

## Key Features

- **Reconnaissance** -- OSINT, DNS enumeration, subdomain discovery, port scanning, service enumeration
- **Vulnerability Analysis** -- nmap NSE, nuclei, nikto, sqlmap, commix, ffuf, manual verification
- **Exploitation** -- Metasploit, custom scripts, password attacks, web exploitation
- **Post-Exploitation** -- Credential access, AD testing, pivoting, persistence, C2 operations
- **Active Directory** -- Responder, impacket, BloodHound, certipy, Kerberoasting, DCSync
- **Red Team Ops** -- PowerShell Empire, Weevely, hash cracking, tunneling (DNS/ICMP/SSL)
- **Exploit Dev** -- radare2, msfvenom, ROPgadget, pattern_create/offset, bad char analysis
- **Threat Modeling** -- STRIDE methodology, attack surface analysis
- **Risk Assessment** -- CVSS v3.1 scoring, MITRE ATT&CK mapping, risk prioritization
- **Reporting** -- Structured reports with anonymization protocol

## Security Tool Inventory

PentAGI can install and use 70+ security tools via Homebrew:

| Category            | Tools                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| Network Recon       | nmap, masscan, amass, subfinder, dnsx, assetfinder, fierce              |
| Web Testing         | gobuster, ffuf, nikto, sqlmap, nuclei, katana, wpscan, commix           |
| Password Attacks    | hydra, john, hashcat, crunch, medusa, hashid                            |
| Exploitation        | metasploit, msfvenom, searchsploit                                      |
| Post-Exploit        | proxychains4, chisel, responder, netexec, evil-winrm, bloodhound-python |
| C2 Frameworks       | powershell-empire, weevely                                              |
| Traffic Analysis    | tshark, tcpdump, mitmproxy, sslscan                                     |
| Reverse Engineering | radare2, ROPgadget, binwalk, ropper                                     |
| Tunneling           | iodine (DNS), ptunnel (ICMP), stunnel4                                  |
| OSINT               | shodan CLI, censys CLI, seclists                                        |

## AI Providers

PentAGI supports two AI providers:

- **Kilo Gateway** -- Unified access to top models via a single API key
- **OpenAI** -- Direct OpenAI API access

Configure providers via the TUI (`/connect`) or in `kilo.json`.

## Project Structure

```
packages/
├── opencode/          # Core CLI engine (agents, tools, sessions, server, TUI)
├── sdk/js/            # Auto-generated TypeScript SDK
├── kilo-gateway/      # Kilo Gateway auth & provider routing
├── kilo-telemetry/    # Telemetry & analytics
├── kilo-ui/           # Shared component library
├── kilo-i18n/         # Internationalization
└── kilo-docs/         # Documentation
```

## Pentesting System Prompts

PentAGI uses modular system prompt files for specialized capabilities:

| Prompt File         | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `pentester.txt`     | Core pentesting specialist -- auth, tools, methodology   |
| `ad_specialist.txt` | Active Directory toolkit and attack patterns             |
| `redteam.txt`       | C2 frameworks, credentials, tunneling, post-exploitation |
| `exploit_dev.txt`   | Exploit development workflow, shellcode, RE tools        |
| `msf_ops.txt`       | Metasploit operational patterns and rules                |
| `threat_model.txt`  | STRIDE, attack surface, CVSS, MITRE ATT&CK               |
| `reporting.txt`     | Anonymization protocol, report structure                 |

## Development

```bash
# Dev mode (TUI)
bun run dev

# Typecheck
bun run typecheck
```

## Contributing

We welcome contributions from security researchers and developers!
To get started:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `bun run typecheck` to verify
5. Submit a pull request

## Code of Conduct

Our community is built on respect, inclusivity, and collaboration. Please review our [Code of Conduct](/CODE_OF_CONDUCT.md) to understand the expectations for all contributors and community members.

## License

This project is licensed under the MIT License.
You're free to use, modify, and distribute this code, including for commercial purposes as long as you include proper attribution and license notices. See [License](/LICENSE).

---

### Credits

PentAGI is a fork of [Kilo Code](https://github.com/Kilo-Org/kilocode) -- an open-source agentic coding platform.
The core CLI, TUI, session management, and AI agent infrastructure are built by the [Kilo-Org](https://github.com/Kilo-Org) community.
PentAGI extends Kilo Code with penetration testing system prompts, security tool integration, and macOS-specific adaptations for offensive security workflows.

Made with ♥ by Ayush
