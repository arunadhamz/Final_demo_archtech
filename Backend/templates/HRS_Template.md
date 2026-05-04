# HARDWARE REQUIREMENTS SPECIFICATION (HRS)

---

## 1 INTRODUCTION

<!-- Add a small introduction of the module here -->

---

### 1.1 Scope

This document will explain how the requirements will meet through the specifications. The targeted audience is HDD. The task for HDD department is as follow, HDD : Preparation and Verification of HRS with respect to the requirement.

---

### 1.2 Acronyms and Abbreviations

The acronyms and abbreviations used in this document are listed in the below Table 1.1.

**Table 1.1 : List of Acronyms and Abbreviations**

| Abbreviation | Description |
|--------------|-------------|
| HRS | Hardware Requirements Specification |
| BID | Board ID |
| ID | Identification |
| PID | Project/ Product ID |
| SID | System ID |
| HRS | Hardware Requirement Specification |
| SYRS | System Requirement Specification |
| XXX | Running Number |

---

### 1.3 Referenced Documents

This section gives the external and internal documents referred to prepare this manual.

#### 1.3.1 External Documents

**Table 1.2 : External Documents**

| S.No. | Document Name | Document ID | Version | Date |
|-------|---------------|-------------|---------|------|
| 1 | | | | |
| 2 | | | | |

#### 1.3.2 Internal Documents

**Table 1.3 : Internal Documents**

| S.No. | Document Name | Document ID | Version | Date |
|-------|---------------|-------------|---------|------|
| 1 | SyRS | System Requirements Specification for \<PRODUCT/SYSTEM\>,
 PRODUCTID-FG-QAP-XVXX, dd.mm.yyyy | | |

---

## 2 MODULE OVERVIEW

<!-- Detailed description/overview of the module here -->

---

### 2.1 Features

<!-- Add features of the module here -->

---

### 2.2 Applications

<!-- Add applications of the module here -->

---

## 3 BLOCK DIAGRAM

<!-- Detailed block diagram of the module with block level explanation here -->

**Figure 3.1 : Block Diagram of \<Module_ID\>**

---

## 4 SPECIFICATIONS

**Table 4.1 : Specifications**

| Parameter | Specification |
|-----------|---------------|
| Type | |
| Processor | |
| INPUT AND OUTPUT SPECIFICATIONS | |
| POWER REQUIREMENTS | |
| Voltage | |
| Current | |
| Power Dissipation | |
| MEMORY | |
| SOFTWARE SUPPORT | |
| INTERFACE / CONNECTORS | |
| COMMUNICATION | |
| MECHANICAL | |
| Dimension (LxBxH) in mm | |
| ENVIRONMENTAL | |
| Operating Temperature | |
| Storage Temperature | |
| Relative Humidity | |
| Commercial / Rugged | |

*(If applicable, specification statements shall be elaborated)*

**Note:** This document is provided with the system requirement traceability number for each requirements as below:

`<BID/PID/SID>-<HRS/SyRS>-XXX`

**Example:**
- <ARCH_TECH_AI>-cPCI-7497-HRS-001 for boards
- <ARCH_TECH_AI>-SIPU-8004-SyRS-001 for products

---

### 4.1 Specification Statement – Type

<!-- Add specification details here -->

---

### 4.2 Specification Statement – Size

<!-- Add specification details here -->

---

### 4.3 Specification Statement – Input and Output Specifications

<!-- Add specification details here -->

---

### 4.4 Specification Statement – Connectors

<!-- Add specification details here -->

---

### 4.5 Specification Statement – Power Requirements

<!-- Add specification details here -->

---

### 4.6 Specification Statement – Environmental Specifications

<!-- Add specification details here -->

---

## 5 FPGA DESIGN REQUIREMENT

---

### 5.1 FPGA / CPLD Description

<!-- Add FPGA/CPLD description here -->

---

### 5.2 FPGA Block Diagram

<!-- Add FPGA block diagram here -->

**Figure 5.1 : FPGA Block Diagram**

---

### 5.3 Functional Requirement

**Table 5.1 : Functional Requirements**

| S.No. | Function Name | Description | Reference if applicable |
|-------|---------------|-------------|------------------------|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |

#### 5.3.1 Functional Requirement Description

*(Every Function has to be described in detail)*

**Filled in Sample:**

**Table 5.2 : Functional Requirements (Sample)**

| S.No. | Function Name | Description | Reference if applicable |
|-------|---------------|-------------|------------------------|
| 1 | PCIe Interface | Interface with X1 PCIe lines. | <ARCH_TECH_AI>-XMC-5007 |
| 2 | ADC Interface | Interface with ADC using SPI and control signal lines. | <ARCH_TECH_AI>-VME-5835 |
| 3 | UART Logic | The UART Logic has to be implemented in the FPGA. | <ARCH_TECH_AI>-IP-422 |

**FUNCTIONAL REQUIREMENT DESCRIPTION**

**PCIe interface**
- X1 PCIe interface
- Reference clock from Processor board will be used for PCIe.
- COMe Module No : <ARCH_TECH_AI>-COMe-0905

**ADC Interface**
- The UART section consists of eight receivers and eight transmitters (UARTs). The UART Interface core is being implemented in the FPGA.
- Baud rate is 760Kbps (2Mbps provision on special request)
- The UART (RS422) Protocol logic will be implemented in Glue Logic
- Control signals required for RS422 line driver is also done by FPGA

Opto-Coupler Part No : HCPL-063L
Line Driver Part No : DS26C31TM

**ADC Interface**
- Two single channel ADC are interfacing with the glue logic sections.
- The IO of the Glue logic section are listed below.
- Both ADC are interface with FPGA by single SPI Bus interface.
- Apart from SPI lines 4 control lines are used for each ADC.

ADC Part Number : AD977ARZ

---

## 6 DEVELOPMENT PLATFORM

**Table 6.1 : Development Platform Requirements**

| S.No. | Parameter | Requirement |
|-------|-----------|-------------|
| 1 | Architecture | |
| 2 | OS | |
| 3 | BUS | |

**Filled in Sample:**

**Table 6.2 : Development Platform (Sample)**

| S.No. | Parameter | Requirement |
|-------|-----------|-------------|
| 1 | Architecture | Power PC |
| 2 | OS | Windows |
| 3 | BUS | PCI |

---

## 7 FAT VALIDATION REQUIREMENT

**Table 7.1 : FAT Validation Requirements**

| Requirement ID | Requirement | Testing Plan | Software |
|----------------|-------------|--------------|----------|
| | | | |
| | | | |
| | | | |

**Filled in Sample:**

**Table 7.2 : FAT Validation Requirements (Sample)**

| Requirement ID | Requirement | Testing Plan | Software |
|----------------|-------------|--------------|----------|
| <BORADID>-HRS-005 | ADC – 4 Channels | Analog input will be given from the ADVANTEC. The digitized value get from the application to be verified with the analog input given. | The digitized value is read by the software from the CVR in the FPGA. |
| <BORADID>-HRS-007 | UART – 1 Channel | Transmitter output is loop back to the Receiver input externally. Transmitter file reference and receiver file reference has to be given. The data need to be transmitted has to be entered in the transmitted file. The data which is received from the receiver has to be placed in the receiver file. The transmitted data and the receiver data to be verified. | The data which is entered in the transmitter file need to be transmitted via UART. The received data at the receiver need to be placed at the receiver file. |

---

## 8 DEMO VALIDATION REQUIREMENT

**Table 8.1 : Demo Validation Requirements**

| Requirement ID | Requirement | Testing Plan | Software |
|----------------|-------------|--------------|----------|
| | | | |
| | | | |
| | | | |

**Filled in Sample:**

**Table 8.2 : Demo Validation Requirements (Sample)**

| Requirement ID | Requirement | Testing Plan | Software |
|----------------|-------------|--------------|----------|
| <BORADID>-HRS-007 | UART – 1 Channel | Transmitter output (RS422) is converted into RS232 using <ARCH_TECH_AI>-SPL-4222. The converted RS232 signal has to be given to receiver RS232 line of PC COM port. And verify the transmitted signal is received in the PC. Similarly Transmitter output (RS232) of the PC COM port has to be converted into RS422 using the <ARCH_TECH_AI>-SPL-4222. The converted RS422 has given to receiver input of the module. Transmit the data from the PC and the verify the transmitted signal has received in PC. | The data which is entered in the transmitter file need to be transmitted via UART. The received data at the receiver need to be placed at the receiver file. |

---

## 9 STANDARD SOFTWARE / FPGA LIBRARY

**Table 9.1 : Standard Software / FPGA Library**

| <ARCH_TECH_AI> Part Number | Library Part Number | Library Description | Remarks |
|----------------|---------------------|---------------------|---------|
| | | | |
| | | | |
| | | | |

---

## ANNEXURES

---

### Annexure A : KC Implementation

*(If applicable)*

List/ Map the KCs provided for the Product/ System design and development, in concurrence with the "KC Implementation Control plan table".

Refer Table A 1 from the KC Guideline document (HDD/KC/GL26).

**Table A 1 : Key Characteristics ID**

| Key Characteristics ID | KC Name/ Specification | Requirement/Section Ref |
|------------------------|------------------------|------------------------|
| KC-\<<ARCH_TECH_AI>-XXXX-YYYY\>-SyRS / HRS-01 | \<Description / specification of the identified KC ID\> | \<Give the section ref / Req. ID that are specified in the document for the KC\> |
| Example: KC-\<<ARCH_TECH_AI>-XXXX-YYYY\>-SyRS / HRS-01 | Eg: Weight | |

---

### Annexure B : Requirement Traceability Matrix

**Table B 1 : Requirement Traceability Matrix**

| S.No. | Requirement ID | Description | SyRS/MRS/User Requirement Specification ID/REF | CMB/CRQ ID/REF | HRS Section No. |
|-------|----------------|-------------|-----------------------------------------------|----------------|-----------------|
| 1 | \<<ARCH_TECH_AI>-XXXX-YYYY\>-HRS/SyRS-001 | | | | |
| 2 | \<<ARCH_TECH_AI>-XXXX-YYYY\>-HRS/SyRS-002 | | | | |
| 3 | \<<ARCH_TECH_AI>-XXXX-YYYY\>-HRS/SyRS-003 | | | | |
| .. | ..... | | | | |
| .. | KC-\<<ARCH_TECH_AI>-XXXX-YYYY\>-HRS/SyRS-01 | | | | |
| n | KC-\<<ARCH_TECH_AI>-XXXX-YYYY\>-HRS/SyRS-0n | | | | |

**Filled in Sample:**

**Table B 2 : Requirement Traceability Matrix (Sample)**

| S.No. | Requirement ID | Description | SyRS/MRS/User Requirement Specification ID/REF | CMB/CRQ ID/REF | HRS Section No. |
|-------|----------------|-------------|-----------------------------------------------|----------------|-----------------|
| 1 | <ARCH_TECH_AI>-cPCI-7497-HRS-001 for board | Power Requirements < 5W | <ARCH_TECH_AI>-SIPU-8004-SyRS-001 | - | 6.5 |
| 2 | <ARCH_TECH_AI>-SIPU-8004-SyRS-001 for products | Weight < 5Kg | URS1-3.3.2 | - | 6.2 |
| 3 | <ARCH_TECH_AI>-SIPU-8004-SyRS-002 for products | Operating temperature -40OC to 70OC | URS2-3.3.1 | - | 6.7 |

---

### Annexure C : Validation Matrix

**Table C 1 : Validation Matrix**

| Requirement ID | Description | Verification Method | Note |
|----------------|-------------|---------------------|------|
| | | QUAL TEST | ATP | INTEGRATION | DEMO | INSPECTION | ANALYSIS | |
| \<<ARCH_TECH_AI>-XXXX-YYYY\>-HRS/SyRS-001 | | | | | | | | |
| \<<ARCH_TECH_AI>-XXXX-YYYY\>-HRS/SyRS-001 | | | | | | | | |
| \<<ARCH_TECH_AI>-XXXX-YYYY\>-HRS/SyRS-001 | | | | | | | | |
| \<<ARCH_TECH_AI>-XXXX-YYYY\>-HRS/SyRS-001 | | | | | | | | |

**Verification Method Definitions:**

| Method | Description |
|--------|-------------|
| QUAL TEST | If the requirement is complied with any qualification testing it comes under Qual Test. (Eg. Environment Specification) |
| ATP | If the requirement is complied with normal functional testing, it comes in ATP. (all the requirement which can be validated can comes under this category) |
| INTEGRATION | If the requirement is complied by integration testing, it comes in INTEGRATION (Unit level, System Level, External Interface level which requires external modules / system for compliance) |
| DEMO | If the requirement is complied with one time validation, it comes under DEMO. (The requirements which have to be qualified but not carried for the production testing) |
| INSPECTION | If the requirement is complied with the physical inspection, it comes under INSPECTION (Eg. Size of the module) |
| ANALYSIS | If the requirement is complied with the any analysis, design compliance it comes under ANALYSIS |

**Filled In Sample:**

**Table C 2 : Validation Matrix (Sample)**

| Requirement ID | Description | Verification Method | Note |
|----------------|-------------|---------------------|------|
| | | QUAL TEST | ATP | INTEGRATION | DEMO | INSPECTION | ANALYSIS | |
| <BORADID>-HRS-001 | Size | | | | | Y | | |
| <BORADID>-HRS-002 | Voltage Range | | Y | | | | | |
| <BORADID>-HRS-003 | Low Temperature | Y | | | | | | |
| <BORADID>-HRS-004 | High Temperature | Y | | | | | | |
| <BORADID>-HRS-005 | Over voltage Protect | | | | | | Y | |
| <BORADID>-HRS-006 | Cycle Time | | | Y | | | | |

---

### Annexure D : Test Setup

#### Test Equipments Required

This section shall be given with required test equipments, test cables (bought out), test cables (fabricated), test jig, test rig, external modules, JTAG, Emulators, software environment, programming file etc.

**Table D 1 : Test Equipment List**

| S.No. | Equipments/ Tool* | Manufacturer | Model Number |
|-------|-------------------|--------------|--------------|
| 1 | | | |
| 2 | | | |

*\*Also include external cooling devices, Ruggedizers*

**Table D 2 : Jig / Cable List**

| S.No. | Jig / Cable Part No. | Jig / Cable Connector Ref | Board / Equipment mating ref (if avail) |
|-------|---------------------|--------------------------|----------------------------------------|
| 1 | | | |
| 2 | | | |

**Table D 3 : Programming Files**

| S.No. | Programming Files** | Device | Development (New / Existing) |
|-------|---------------------|--------|------------------------------|
| 1 | | | |
| 2 | | | |

\*\*Also include onboard and PC files

#### Test Setup

This section shall be given with test setup with interconnection details and equipment connectivity.

> **Note:** This section shall be provided in tentative for planning of required test setup and jig in advance.

<!-- Add test setup diagram/details here -->

---

## Document Control

| Document Information | Details |
|---------------------|---------|
| Document Title | Hardware Requirements Specification (HRS) |
| Document ID | |
| Module Name | |
| Module ID | |
| Version | |
| Date | |
| Prepared By | |
| Reviewed By | |
| Approved By | |

---

## Revision History

| Version | Date | Author | Description of Changes |
|---------|------|--------|----------------------|
| 1.0 | | | Initial Draft |
| | | | |

---

*End of Document*
