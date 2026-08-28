# 🗂️ SIH26155 — Training Data & Config Datasets Master List
## Everything You Need to Fine-Tune Your Model

---

# THE REALITY CHECK

Getting real network configs is **the hardest part** of this project. Here's why:

- Network configs contain **sensitive data** (IP addresses, passwords, network topology) — companies don't publish them
- There is **NO single massive dataset** like ImageNet or Common Crawl for network configs
- Most researchers **build their own datasets** using a mix of sources + synthetic generation

**Your strategy should be:** Collect from EVERY source below + generate synthetic data to fill gaps.

---

# CATEGORY 1: READY-TO-USE DATASETS (Download and Start Training)

These are actual datasets specifically designed for network config NLP tasks.

---

### 1. 🏆 Smarneh/NIT (Network Intent Translation)
- **Link:** https://huggingface.co/datasets/Smarneh/NIT
- **What:** 1,000 entries of natural language intents paired with Juniper EX3300 switch configurations
- **Format:** Question → Context → CLI Answer
- **Example entry:**
  - Intent: "Configure VLAN 100 with name SERVERS"
  - Config: `set vlans SERVERS vlan-id 100`
- **Use for:** Training the SLM to understand the relationship between intent and config syntax
- **Vendor:** Juniper
- **Size:** ~1,000 samples
- **Quality:** ⭐⭐⭐⭐ (academic quality, well-structured)

---

### 2. 🏆 Elfsong/new_cisco_bench
- **Link:** https://huggingface.co/datasets/Elfsong/new_cisco_bench
- **What:** Cisco networking tasks benchmark — structured questions about Cisco config knowledge
- **Use for:** Testing/evaluating your model's understanding of Cisco syntax
- **Vendor:** Cisco
- **Quality:** ⭐⭐⭐⭐

---

### 3. 🏆 NetConfEval/NetConfEval
- **Link:** https://huggingface.co/datasets/NetConfEval/NetConfEval
- **What:** Scenarios for generating low-level configs from high-level requirements (routing, device setup)
- **Use for:** Teaching the model to understand config structure and intent mapping
- **Quality:** ⭐⭐⭐⭐

---

### 4. darkknight25/Networking_Commands_Dataset
- **Link:** https://huggingface.co/datasets/darkknight25/Networking_Commands_Dataset
- **What:** Broad collection of networking commands including `show running-config` patterns
- **Use for:** General command classification training
- **Vendor:** Multi-vendor
- **Quality:** ⭐⭐⭐

---

### 5. neerajnarwal/Command_Generation
- **Link:** https://huggingface.co/datasets/neerajnarwal/Command_Generation
- **What:** Command generation task dataset across various OS environments
- **Use for:** Teaching the model to generate valid CLI commands
- **Quality:** ⭐⭐⭐

---

### 6. 🏆 Purdue University ISL — Campus Network Configs
- **Link:** https://engineering.purdue.edu/~isl/network-config/
- **What:** Anonymized config snapshots from ~1,600 Cisco routers and switches in a real campus network
- **Format:** Raw config files (anonymized IPs and hostnames)
- **Access:** Academic researchers only — you need to email Professor Sanjay Rao and request access
- **Use for:** MASSIVE real-world Cisco IOS training data
- **Vendor:** Cisco (IOS)
- **Size:** ~1,600 config files (HUGE for this domain)
- **Quality:** ⭐⭐⭐⭐⭐ (real production configs, largest known public dataset)
- **How to request:** Email the ISL lab referencing your SIH26155 project as academic research

---

### 7. cisco-ie/telemetry
- **Link:** https://github.com/cisco-ie/telemetry
- **What:** Open-source datasets related to Cisco network telemetry and research
- **Use for:** Understanding Cisco device outputs and telemetry data
- **Quality:** ⭐⭐⭐

---

# CATEGORY 2: CONFIG FILE REPOSITORIES (Real Config Examples on GitHub)

These repos contain actual config files or realistic examples you can directly use.

---

### 8. tireland1985/cisco-config-examples
- **Link:** https://github.com/tireland1985/cisco-config-examples
- **What:** Dedicated repository of Cisco IOS config examples
- **Vendor:** Cisco IOS
- **Use for:** Direct training data

### 9. epiecs/cisco-config-snippets
- **Link:** https://github.com/epiecs/cisco-config-snippets
- **What:** Various Cisco config snippets covering different features
- **Vendor:** Cisco IOS

### 10. jasonadsit/NetworkDeviceConfigs
- **Link:** https://github.com/jasonadsit/NetworkDeviceConfigs
- **What:** Basic Cisco router config files demonstrating standard commands
- **Vendor:** Cisco IOS

### 11. CiscoDevNet/cvd-config-templates
- **Link:** https://github.com/CiscoDevNet/cvd-config-templates
- **What:** Cisco Validated Design configuration management templates — these are **official best-practice configs** from Cisco themselves
- **Vendor:** Cisco (IOS, NX-OS)
- **Quality:** ⭐⭐⭐⭐⭐ (official vendor source)

### 12. cbachert/Cisco_IOS_Ansible_Template
- **Link:** https://github.com/cbachert/Cisco_IOS_Ansible_Template
- **What:** Hardened Cisco IOS config template based on CIS benchmarks
- **Vendor:** Cisco IOS
- **Special value:** Already aligned with CIS compliance — perfect for training your compliance model!

### 13. 🏆 Juniper/jvd (Juniper Validated Designs)
- **Link:** https://github.com/Juniper/jvd
- **What:** Official Juniper best-practice configuration blueprints across various use cases (campus, data center, WAN)
- **Vendor:** Juniper JunOS
- **Quality:** ⭐⭐⭐⭐⭐ (official vendor source, production-grade)
- **Special value:** These are "golden configs" — use them as the desired/compliant state

### 14. 🏆 Batfish sample configs (built into Batfish)
- **Link:** https://github.com/batfish/batfish (check `tests/` and `questions/` directories)
- **Also:** https://github.com/batfish/pybatfish (check `jupyter_notebooks/networks/` folder)
- **What:** Multi-vendor test configs used by Batfish for testing — includes Cisco IOS, NX-OS, Juniper JunOS, Palo Alto PAN-OS, Arista EOS, Fortinet, AWS, Azure
- **Vendor:** MULTI-VENDOR (this is gold!)
- **Quality:** ⭐⭐⭐⭐⭐
- **How to get them:** Run `docker pull batfish/allinone` and explore the container, or browse the GitHub test directories

### 15. HPENetworking/HPEIMCUtils
- **Link:** https://github.com/HPENetworking/HPEIMCUtils
- **What:** Contains Arista and other vendor sample config files
- **Vendor:** Arista, HPE

### 16. FRRouting/frr
- **Link:** https://github.com/FRRouting/frr
- **What:** Free Range Routing — open-source routing stack. The test/example directories contain realistic routing configurations
- **Vendor:** FRR (open-source, similar to Cisco/Juniper routing syntax)

---

# CATEGORY 3: CONFIG GENERATORS (Create Unlimited Synthetic Training Data)

When you run out of real configs, GENERATE more. These tools create syntactically valid configs.

---

### 17. 🏆 NetworkConfigPro
- **Link:** https://github.com/E-Conners-Lab/NetworkConfigPro
- **What:** Multi-vendor config generator supporting Cisco IOS, NX-OS, Arista EOS, Juniper, SONiC, and Fortinet
- **How to use:** Define network parameters in YAML → it generates valid configs for EVERY vendor from the same data
- **Training value:** Generate 1,000 configs from 1,000 YAML variations = instant multi-vendor dataset
- **Quality:** ⭐⭐⭐⭐⭐ (multi-vendor, exactly what you need)

### 18. careed23/The-Network-Config-Generator
- **Link:** https://github.com/careed23/The-Network-Config-Generator
- **What:** Generates standardized Cisco and Juniper configs from YAML + Jinja2 templates
- **How to use:** Modify YAML variables (IPs, VLANs, hostnames) → get different but valid configs each time
- **Vendor:** Cisco, Juniper

### 19. NetCanon/netcanon
- **Link:** https://github.com/netcanon/netcanon
- **What:** Multi-vendor network config TRANSLATOR — converts configs between Cisco, Juniper, Fortinet, Aruba, Arista
- **Training value:** Feed it a Cisco config → get the equivalent Juniper/Fortinet/Arista config. Perfect for creating parallel training pairs!
- **Quality:** ⭐⭐⭐⭐⭐ (creates vendor-to-vendor translation pairs)

### 20. AnonymousWP/IOS-Configuration-Generator
- **Link:** https://github.com/AnonymousWP/IOS-Configuration-Generator
- **What:** Python/PowerShell scripts to generate Cisco IOS configs with random parameters
- **Vendor:** Cisco IOS

### 21. Tes3awy/Cisco-Configuration-Using-Python-Jinja-CSV
- **Link:** https://github.com/Tes3awy/Cisco-Configuration-Using-Python-Jinja-CSV
- **What:** Generate Cisco configs from CSV data + Jinja2 templates
- **Training strategy:** Create a CSV with 500 rows of different parameters → generate 500 unique configs

---

# CATEGORY 4: VENDOR OFFICIAL DOCUMENTATION (The Ground Truth)

These are official docs you can scrape/parse to build training data.

---

### 22. Cisco Configuration Guides
- **Link:** https://www.cisco.com/c/en/us/support/all-products.html
- **What:** Official Cisco config guides for every product (IOS, IOS-XE, NX-OS, ASA, Firepower)
- **How to use:** Each guide contains HUNDREDS of config examples. Scrape the example blocks.
- **Example page:** https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/sec_usr_ssh/configuration/xe-16/sec-usr-ssh-xe-16-book.html (SSH config guide — full of examples)

### 23. Juniper TechLibrary
- **Link:** https://www.juniper.net/documentation/
- **What:** Official Juniper configuration documentation with extensive examples
- **How to use:** Every feature page has "Configuration Examples" sections

### 24. Palo Alto Networks Documentation
- **Link:** https://docs.paloaltonetworks.com/
- **What:** PAN-OS config guides with CLI and XML examples
- **How to use:** Focus on the "CLI Reference" and "Administrator's Guide" sections

### 25. Fortinet FortiGate Docs
- **Link:** https://docs.fortinet.com/
- **What:** FortiOS CLI reference with config examples
- **Special:** FortiOS uses a unique `config` / `edit` / `set` / `end` syntax — essential training data

### 26. Arista EOS Documentation
- **Link:** https://www.arista.com/en/support/product-documentation
- **What:** Arista EOS config guides
- **Note:** Arista EOS is very similar to Cisco IOS but has differences your model should learn

### 27. SONiC Documentation
- **Link:** https://github.com/sonic-net/SONiC/wiki
- **Also:** https://github.com/sonic-net/sonic-buildimage
- **What:** SONiC config_db.json schema documentation and examples
- **Special:** All JSON — completely different from CLI-based vendors

### 28. MikroTik Documentation
- **Link:** https://help.mikrotik.com/docs/
- **What:** RouterOS config reference
- **Special:** Uses `/ip`, `/system`, `/interface` path-based syntax — very different from others

---

# CATEGORY 5: CONFIG BACKUP TOOLS (For Building Your Own Dataset)

If you have access to lab devices (Cisco DevNet sandboxes, GNS3, ContainerLab), use these tools to BULK-COLLECT configs.

---

### 29. 🏆 Oxidized (Config Backup & Version Control)
- **Link:** https://github.com/ytti/oxidized
- **Stars:** 2,800+
- **What:** Automatically connects to network devices, backs up configs, stores them in Git
- **Supports:** 100+ device types (Cisco, Juniper, Arista, Fortinet, Palo Alto, HP, MikroTik, etc.)
- **Training use:** Set up Oxidized against your lab devices → it collects configs automatically → you have a Git repo full of configs
- **Quality:** ⭐⭐⭐⭐⭐ (industry standard backup tool)

### 30. RANCID (Really Awesome New Cisco confIg Differ)
- **Link:** https://github.com/haussli/rancid (original: https://www.shrubbery.net/rancid/)
- **What:** The original network config backup tool (predecessor to Oxidized)
- **Training use:** Same as Oxidized but older — many organizations still use it, and there are RANCID config archives on GitHub

### 31. aaronmelton/DownloadRouterConfig
- **Link:** https://github.com/aaronmelton/DownloadRouterConfig
- **What:** Simple Python script to SSH into a list of Cisco routers and download their running configs
- **Training use:** Point it at DevNet sandboxes → get real configs instantly

---

# CATEGORY 6: ACADEMIC RESEARCH DATASETS & PAPERS

---

### 32. 🏆 SLM_netconfig (Small Language Model for Network Config)
- **Paper:** https://arxiv.org/abs/2512.02861
- **What:** Academic paper that built a domain-specific dataset from vendor documentation for fine-tuning SLMs
- **Relevance:** Their EXACT approach is what you need — they describe how to build the dataset step-by-step
- **Strategy they used:**
  1. Scraped vendor CLI manuals
  2. Generated intent-config pairs using GPT-4
  3. Validated generated configs using network simulators
  4. Fine-tuned Llama/Qwen with LoRA
- **You should:** Read this paper and replicate their data pipeline

### 33. dsm2cli (Desired State Model to CLI)
- **Paper:** https://sol.sbc.org.br/index.php/sbrc_estendido/article/download/42581/42348
- **What:** A pipeline for translating structured intents into vendor-specific CLI
- **Dataset:** They created their own intent-to-CLI dataset

### 34. NetConfEval (Benchmarking LLMs for Network Config)
- **Paper:** Associated with the Hugging Face dataset (entry #3 above)
- **What:** Academic benchmark for evaluating how well LLMs generate network configs

### 35. Cornetto (Benchmarking Config Repair)
- **Paper:** https://arxiv.org/html/2604.22513v1
- **What:** Generates synthetic misconfiguration scenarios for testing repair systems
- **Training use:** Use their generation pipeline to create "broken config → fixed config" pairs for training

### 36. NIKA (Network Incidents for AI Agents)
- **Link:** https://github.com/sands-lab/nika
- **Paper:** https://arxiv.org/html/2512.16381v1
- **What:** A network arena with realistic BGP/VXLAN/DNS failure scenarios across emulated topologies
- **Contains:** Real config files for multi-vendor topologies

---

# CATEGORY 7: GITHUB SEARCH STRATEGIES (Find More Configs Yourself)

Use these search queries on GitHub to find config files scattered across thousands of repos:

---

### Search Queries to Try

| Query | What You'll Find |
|-------|-----------------|
| `filename:running-config.txt` | Cisco running config files |
| `filename:config_db.json "SSH_SERVER"` | SONiC config files |
| `filename:juniper.conf` | Juniper JunOS configs |
| `"hostname" "interface" "ip address" extension:cfg` | Cisco IOS config files |
| `"set system services ssh" extension:conf` | Juniper set-format configs |
| `"config system global" "set hostname"` | FortiGate FortiOS configs |
| `"set deviceconfig system" "set network"` | Palo Alto PAN-OS configs |
| `"router bgp" "neighbor" extension:conf` | BGP routing configs (multi-vendor) |
| `"ip access-list" OR "firewall filter" extension:txt` | ACL configs (Cisco + Juniper) |
| `"ntp server" "logging host" "service password-encryption"` | Security-relevant Cisco configs |
| `path:configs "show running-config"` | Config backup repositories |
| `RANCID-CONTENT-TYPE cisco` | Configs backed up by RANCID tool |

### How to Search

1. Go to https://github.com/search
2. Select "Code" tab
3. Paste query
4. Filter by language: "Shell" or no filter
5. Browse results, download interesting config files
6. **ALWAYS SANITIZE** — remove real IPs, passwords, and hostnames before using for training

---

# CATEGORY 8: LIVE DEVICE ACCESS (Generate Your Own Fresh Configs)

### Cisco DevNet Always-On Sandboxes (FREE, No Reservation)

| Device | Host | Port | User | Pass |
|--------|------|------|------|------|
| IOS XE (CSR1000v) | `sandbox-iosxe-latest-1.cisco.com` | 22 | `admin` | `C1sco12345` |
| IOS XR (XRv9000) | `sandbox-iosxr-1.cisco.com` | 22 | `admin` | `C1sco12345` |
| NX-OS (Nexus 9000v) | `sandbox-nxos-1.cisco.com` | 22 | `admin` | `Admin_1234!` |
| ASA (ASAv) | `sandbox-asa-1.cisco.com` | 22 | `admin` | `Admin_1234!` |

**What to do:** SSH in, run `show running-config`, save the output. Each sandbox has a different config. Modify the config, save again — now you have 2 training samples per device.

**DevNet portal:** https://developer.cisco.com/site/sandbox/

### Juniper vLabs (FREE, Requires Reservation)
- **Link:** https://jlabs.juniper.net/vlabs/
- **What:** Virtual Juniper devices (SRX, EX, MX, QFX) you can spin up for free
- **Config access:** Full SSH access, run `show configuration` to get JunOS configs

### ContainerLab (FREE, Run Locally)
- **Link:** https://github.com/srl-labs/containerlab
- **What:** Spin up network labs using containers — SONiC, Nokia SR Linux, Arista cEOS
- **SONiC images are FREE** — no license needed
- **Training use:** Deploy 10 SONiC containers with different configs → 10 JSON training samples

### GNS3 (FREE Software, Needs Vendor Images)
- **Link:** https://www.gns3.com/
- **What:** Network emulator that runs real Cisco/Juniper/Fortinet images as VMs
- **Note:** You need vendor firmware images (some require a Cisco account or license)

---

# YOUR DATA PIPELINE STRATEGY

Here's how to combine all of the above into a training dataset:

```
STEP 1: COLLECT REAL CONFIGS (Target: 500-1000 files)
├── Download Purdue ISL dataset (1,600 Cisco configs) ← request access
├── Download Batfish test configs (multi-vendor)
├── Clone GitHub repos (#8-#16 above)
├── SSH into DevNet sandboxes, save 4 configs
├── Clone Juniper JVD repo
└── Clone CiscoDevNet/cvd-config-templates

STEP 2: GENERATE SYNTHETIC CONFIGS (Target: 2000-5000 files)
├── Use NetworkConfigPro to generate multi-vendor configs
├── Use NetCanon to translate Cisco → Juniper → Fortinet → Arista
├── Use Jinja2 + YAML templates with randomized parameters
└── Validate all synthetic configs with Batfish

STEP 3: CREATE TRAINING PAIRS (Target: 5000-10000 pairs)
├── For each config line, create a pair:
│   Input: "ip ssh version 2"
│   Output: { category: "ssh_config", oc_path: "/system/ssh-server/config/protocol-version", value: "V2" }
├── Use vendor documentation to create intent pairs:
│   Input: "Configure SSH version 2 on this device"
│   Output: "ip ssh version 2" (Cisco) / "set system services ssh protocol-version v2" (Juniper)
├── Use NIT dataset for Juniper pairs
└── Use NetConfEval for routing config pairs

STEP 4: CREATE COMPLIANCE TRAINING DATA (Target: 2000+ pairs)
├── For each CIS benchmark rule, create pass/fail examples:
│   Input: config with "ip ssh version 2"
│   Output: { rule: "CIS-1.1.1", status: "PASS" }
│   Input: config with "ip ssh version 1"
│   Output: { rule: "CIS-1.1.1", status: "FAIL" }
├── For each STIG rule, create examples with CAT severity
└── Mix compliant and non-compliant configs (50/50 split)

STEP 5: SANITIZE & LABEL
├── Remove all real IPs → replace with 10.x.x.x
├── Remove all passwords → replace with <REDACTED>
├── Remove all hostnames → replace with generic names
├── Label each config with: vendor, OS version, feature area
└── Store in structured JSON/JSONL format for Hugging Face datasets library

TOTAL TARGET: 10,000-15,000 training samples across 5+ vendors
```

---

# QUICK REFERENCE: TOP 5 MOST VALUABLE SOURCES

| # | Source | Why It's #1 |
|---|--------|-------------|
| 1 | **Purdue ISL** (1,600 real Cisco configs) | Largest known real-world config dataset |
| 2 | **NetworkConfigPro** (synthetic multi-vendor) | Generate unlimited configs for 6 vendors from YAML |
| 3 | **Batfish test configs** (multi-vendor real) | Only source with Cisco + Juniper + PAN-OS + Arista + Fortinet + AWS all in one place |
| 4 | **Smarneh/NIT** (Hugging Face intent dataset) | Only high-quality intent-to-config dataset available |
| 5 | **NetCanon** (config translator) | Creates parallel vendor translation pairs automatically |

---

> **With these sources combined, you can build a 10,000+ sample multi-vendor training dataset. Start with the Hugging Face datasets (instant download), then the GitHub config repos (a day of collection), then synthetic generation (a weekend of scripting), and finally the Purdue ISL request (may take a week for approval).**
