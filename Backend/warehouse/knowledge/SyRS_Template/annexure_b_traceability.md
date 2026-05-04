# SYSTEM_REQUIREMENTS_SPECIFICATION_(SyRS)_-_ANNEXURE_B:_REQUIREMENT_TRACEABILITY

## Annexure B - Requirement Traceability Matrix

The Requirement Traceability Matrix (RTM) provides a systematic method for tracing requirements through all stages of the development lifecycle. This ensures that all requirements are implemented and verified.

### RTM Structure

The RTM includes the following information for each requirement:
- Requirement ID
- Requirement Description
- Source Document Reference
- Change Request Reference
- Related HRS Section
- Related SyRS Section

### Requirement Identification

Each requirement is identified with a unique identifier in the format:
`<XXXX-YYYY>-SyRS-ZZZ`

Where:
- XXXX-YYYY represents the specific system or board identifier
- SyRS indicates the document type
- ZZZ represents the sequential number for the requirement

### Traceability Elements

The RTM tracks:
- Forward traceability from requirements to design elements
- Backward traceability from design elements to requirements
- Horizontal traceability between related requirements
- Vertical traceability through different levels of system hierarchy

### Sample Traceability Entries

| S. No. | Requirement ID | Description | SyRS/MRS/User Requirement Specification ID/Ref | CMB/CRQ ID/Ref | HRS Section No. | SyRS Section No. |
|--------|----------------|-------------|-----------------------------------------------|----------------|-----------------|------------------|
| 1 | cPCI-7497-HRS-001 for board | Power requirements < 5W | SIPU-8004-SyRS-001 | | | |
| 2 | SIPU-8004-SyRS-001 for products | Weight < 5Kg | URS1-3.3.2 | | | |
| 3 | SIPU-8004-SyRS-002 for products | Operating temperature -40ºC to 70ºC | URS2-3.3.1 | | | |

### Key Characteristics Traceability

Key Characteristics are specially identified in the RTM:
| S. No. | Requirement ID | Description | SyRS/MRS/User Requirement Specification ID/Ref | CMB/CRQ ID/Ref | HRS Section No. | SyRS Section No. |
|--------|----------------|-------------|-----------------------------------------------|----------------|-----------------|------------------|
| .. | KC-<XXXX-YYYY>-SyRS-01 | | | | | |
| n | KC-<XXXX-YYYY>-SyRS-0n | | | | | |

### Benefits of Requirement Traceability

The RTM provides the following benefits:
- Ensures all requirements are addressed
- Facilitates impact analysis of changes
- Supports verification and validation activities
- Aids in certification and compliance activities
- Enables effective configuration management

This traceability matrix ensures that all system requirements are properly documented, implemented, and verified throughout the development lifecycle.