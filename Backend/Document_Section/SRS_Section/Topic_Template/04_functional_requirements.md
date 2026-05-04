
## 4. FUNCTIONAL REQUIREMENTS

<!-- 

> Use the Requirement ID as a example and generate based on this

**Table 4.1: <Board ID> Board Validation Test Requirement IDs**

| Si.No. | Requirement ID | Requirement Name | Reference Requirement ID |
|--------|----------------|-------------------------|-------------------------|
| 1 | <BOARD_ACRONYM>_<HOST>_01 | Host Application | <REF ID or NEW> |
| 2 | <BOARD_ACRONYM>_<TARGET>_02 | Target Application | <REF ID or NEW> |
| 3 | <BOARD_ACRONYM>_<FW or FIRMWARE>_03 | <MCU - Microcontroler or other> Firmware | <REF ID or NEW> |
| 4 | <BOARD_ACRONYM>_<Other COMPONENT >_04 | <Component Test> | <REF ID or NEW> |
.
...

> Use subrequirement table is needed or not.

**Table 4.<NO>: <Board ID> Board Validation Test Sub-Requirement IDs**

| Si.No. | Requirement ID | Requirement Name | Reference Requirement ID |
|--------|----------------|------------------------|-------------------------|
| 1 | <BOARD_ACRONYM>_HOST_<FUNC>_01_01 | <Sub-requirement> | <REF ID or NEW> |
| 2 | <BOARD_ACRONYM>_TARGET_<FUNC>_02_01 | <Sub-requirement> | <REF ID or NEW> |
| 3 | <BOARD_ACRONYM>_FW_<FUNC>_03_01 | <Sub-requirement> | <REF ID or NEW> |
| 4 | <BOARD_ACRONYM>_<COMPONENT Acronyms>_<FUNC>_04_01 | <Sub-requirement> | <REF ID or NEW> |
.
...

-->

---

### 4.1 Host Application

> Use this section only if the system requires Host Application / GUI. Otherwise add the content as NA.

<!-- 
> Eaxmple :
**Description:**
The host application is a <GUI/command-line> application that runs on <platform: test PC/server> for <primary purpose: transmitting commands/receiving data/controlling operations>.

**Table 4.<NO>: Host Application Test Requirement**

| Si.No | Requirement ID | Requirement Name |
|-------|----------------|------------------------|
| 1 | <BOARD_ACRONYM>_HOST_01 | Host Application |

**Table 4.<NO>: Host Application Test Sub Requirements**

| Si.No | Sub Requirement ID | Requirement Name |
|-------|-------------------|------------------------|
| 1 | <BOARD_ACRONYM>_HOST_USR_AUTH_01_01 | User Authentication |
| 2 | <BOARD_ACRONYM>_HOST_INIT_01_02 | Initialization |
| 3 | <BOARD_ACRONYM>_HOST_USR_MGMT_01_03 | User Management |
| 4 | <BOARD_ACRONYM>_HOST_<FUNC>_01_04 | <Additional Function> |
-->

---

#### 4.1.1 User Authentication

> Use this section only if the system requires Host Application / GUI. Otherwise add the content as NA.

<!--
> Example :
**Description:**
The user authentication module shall ensure that only authorized users are allowed to access the software. The module shall get the user name and password from user. Then it shall evaluate the user name and password entered by the user and allows the user to proceed if both are valid. Any invalid input shall lead to the display of an error message and prompt for the user to re-enter the details.

**Table 4.<NO>: User Authentication**
| Requirement ID | Requirement Description |
|----------------|------------------------|
| <BOARD_ACRONYM>_HOST_USR_AUTH_01_01 | **Description** |
-->
---

#### 4.1.2 Initialization

> Use this section only if the system requires Host Application / GUI. Otherwise add the content as NA.

<!--
> Example :
**Description:**
This module shall ensure that the initialization of <communication interface> between host and <target component> is established successfully. This module shall enable or disable the connection between host application and <target> through <interface> based on software control.

**Table 4.<NO>: Initialization**

| Requirement ID | Requirement Description |
|----------------|------------------------|
| <BOARD_ACRONYM>_HOST_INIT_01_02 | **Description:** |
-->

---

#### 4.1.3 User Management

> Use this section only if the system requires Host Application / GUI. Otherwise add the content as NA.

<!--
> Example :
**Description:**
This module shall provide an option to change the password for the user name and manage user access levels.

**Table 4.<NO>: User Management**

| Requirement ID | Requirement Description |
|----------------|------------------------|
| <BOARD_ACRONYM>_HOST_USR_MGMT_01_03 | **Description:** |

-->

---

### 4.2 Target Application

> Use this section only if the system requires Target Application. Otherwise add the content as NA.

<!--
> Example :
**Description:**
The target application runs in the <SBC/Processing Unit> which access and control <FPGA/Processor> device in the <BOARD ID> module as <master/slave/controller>.

**Table 4.<NO>: Target Application Test Requirement**

| Si.No | Requirement ID | Requirement Description |
|-------|----------------|------------------------|
| 1 | <BOARD_ACRONYM>_TARGET_02 | Target Application |

**Table 4.<NO>: Target Application Test Sub Requirements**

| Si.No | Sub Requirement ID | Requirement Description |
|-------|-------------------|------------------------|
| 1 | <BOARD_ACRONYM>_TARGET_BRD_DETAILS_02_01 | Get Board Details |
| 2 | <BOARD_ACRONYM>_TARGET_FPGA_RDWR_02_02 | FPGA Read & Write |
| 3 | <BOARD_ACRONYM>_TARGET_DDR_02_03 | DDR Test |
| 4 | <BOARD_ACRONYM>_TARGET_TEMP_02_04 | Temperature Test |
| 5 | <BOARD_ACRONYM>_TARGET_<INTERFACE>_02_05 | <Interface Test> |
| 6 | <BOARD_ACRONYM>_TARGET_<COMPONENT>_02_06 | <Component Test> |
| 7 | <BOARD_ACRONYM>_TARGET_<STORAGE>_02_07 | <Storage Test> |
.
...
-->

---

#### 4.2.1 Get Board Details
> Use this section only if the system requires Target Application. Otherwise add the content as NA.

<!--
> Example :
**Description:**
The <BOARD ID> has three Read only registers for reading board details such as board ID, board version and type ID. On selecting this test, <interface> read operation shall be performed in these registers and displayed in the console.

**Table 4.<NO>: Get Board Details**

| Requirement ID | Requirement Description |
|----------------|------------------------|
| <BOARD_ACRONYM>_TARGET_BRD_DETAILS_02_01 | **Description:** |
-->

---

#### 4.2.2 FPGA Read & Write
> Use this section only if the system requires Target Application. Otherwise add the content as NA.

<!-- 
> Example :
**Description:**
This test case shall be selected for <N>-bit data write and read from <N>-bit address. For validating read and write operation, writing to and reading from scratchpad register (address 0x<XX>) shall be performed.

**Table 4.<NO>: FPGA Read & Write**

| Requirement ID | Requirement Description |
|----------------|------------------------|
| <BOARD_ACRONYM>_TARGET_FPGA_RDWR_02_02 | **Description:** |
-->

---

#### 4.2.3 DDR Test
> Use this section only if the system requires Target Application. Otherwise add the content as NA.

<!--
> Example :
**Table 4.<NO>: DDR Test Requirement**

| Si.No | Requirement ID | Requirement Description |
|-------|----------------|------------------------|
| 1 | <BOARD_ACRONYM>_TARGET_DDR_02_03 | FPGA DDR Test |

**Table 4.<NO>: DDR Test Sub Requirement**

| Si.No | Sub Requirement ID | Requirement Description |
|-------|-------------------|------------------------|
| 1 | <BOARD_ACRONYM>_TARGET_DDR_02_03_01 | DDR Full Memory Test |
| 2 | <BOARD_ACRONYM>_TARGET_DDR_02_03_02 | DDR Data Bus Test |
| 3 | <BOARD_ACRONYM>_TARGET_DDR_02_03_03 | DDR Address Bus Test |
| 4 | <BOARD_ACRONYM>_TARGET_DDR_02_03_04 | DDR Device Test |
-->
---

##### 4.2.3.1 DDR Full Memory Test

> Use this section only if the system requires Target Application. Otherwise add the content as NA.

<!--
**Description:**
The <BOARD ID> DDR full memory test shall be performed by writing and reading predefined pattern data and Anti-pattern data in each location of all memory banks.

> Example :
**Table 4.<NO>: DDR Full Memory Test**

| Sub Requirement ID | Requirement Description |
|-------------------|------------------------|
| <BOARD_ACRONYM>_TARGET_DDR_02_03_01 | **Description:** |

-->
---

##### 4.2.3.2 DDR Data Bus Test

> Use this section only if the system requires Target Application. Otherwise add the content as NA.

<!--
> Example :
**Description:**
This test shall be selected for validating the <N>-bit data lines in the DDR memory by performing walking 1's and walking 0's test.

**Table 4.<NO>: DDR Data Bus Test**

| Sub Requirement ID | Requirement Description |
|-------------------|------------------------|
| <BOARD_ACRONYM>_TARGET_DDR_02_03_02 | **Description:** |

-->
---

##### 4.2.3.3 DDR Address Bus Test
> Use this section only if the system requires Target Application. Otherwise add the content as NA.

<!--
> Example :
**Description:**
This test shall be selected for validating <N>-bit address lines in the DDR memory by writing known pattern and anti-pattern data.

**Table 4.<NO>: DDR Address Bus Test**

| Sub Requirement ID | Requirement Description |
|-------------------|------------------------|
| <BOARD_ACRONYM>_TARGET_DDR_02_03_03 | **Description:** |

-->
---

##### 4.2.3.4 DDR Device Test
> Use this section only if the system requires Target Application. Otherwise add the content as NA.

<!--
> Example :
**Description:**
This test shall be selected for validating whether every bit in the device is capable of holding both 0s and 1s.

**Table 4.<NO>: DDR Device Test**

| Sub Requirement ID | Requirement Description |
|-------------------|------------------------|
| <BOARD_ACRONYM>_TARGET_DDR_02_03_04 | **Description:** |

-->
---

#### 4.2.4 Temperature Test
> Use this section only if the system requires Target Application. Otherwise add the content as NA.

<!--
> Example :
**Table 4.<NO>: Temperature Test Requirement**

| Si.No | Requirement ID | Requirement Description |
|-------|----------------|------------------------|
| 1 | <BOARD_ACRONYM>_TARGET_TEMP_02_04 | Temperature Test |

**Table 4.<NO>: Temperature Test Sub Requirements**

| Si.No | Sub Requirement ID | Requirement Description |
|-------|-------------------|------------------------|
| 1 | <BOARD_ACRONYM>_TARGET_TEMP_02_04_01 | Read Local Temperature |
| 2 | <BOARD_ACRONYM>_TARGET_TEMP_02_04_02 | Read Remote Temperature |
-->

---

##### 4.2.4.1 Local Temperature Read
> Use this section only if the system requires Target Application. Otherwise add the content as NA.

<!--
> Example :
**Description:**
This test case shall be selected for reading local temperature value from the dedicated register through <interface>.

**Table 4.<NO>: Local Temperature Read Test**

| Sub Requirement ID | Requirement Description |
|-------------------|------------------------|
| <BOARD_ACRONYM>_TARGET_TEMP_02_04_01 | **Description:** |
-->
---

##### 4.2.4.2 Remote Temperature Read
> Use this section only if the system requires Target Application. Otherwise add the content as NA.

<!--
> Example :
**Description:**
This test case shall be selected for reading remote temperature value from the sensor.
**Table 4.<NO>: Remote Temperature Read Test**

| Sub Requirement ID | Requirement Description |
|-------------------|------------------------|
| <BOARD_ACRONYM>_TARGET_TEMP_02_04_02 | **Description:** |


-->
---

#### 4.2.5 <Interface/Test> Test
> Use this section only if the system requires Target Application. Otherwise add the content as NA.
<!--
> Example :
**Table 4.<NO>: <Interface/Test> Test Requirement**

| Si.No | Requirement ID | Requirement Description |
|-------|----------------|------------------------|
| 1 | <BOARD_ACRONYM>_TARGET_<INTERFACE>_02_05 | <Interface/Test> Test |

**Table 4.<NO>: <Interface/Test> Test Sub Requirement**

| Si.No | Sub Requirement ID | Requirement Description |
|-------|-------------------|------------------------|
| 1 | <BOARD_ACRONYM>_TARGET_<INTERFACE>_02_05_01 | <Sub-test 1> |
| 2 | <BOARD_ACRONYM>_TARGET_<INTERFACE>_02_05_02 | <Sub-test 2> |
| 3 | <BOARD_ACRONYM>_TARGET_<INTERFACE>_02_05_03 | <Sub-test 3> |
-->
---

#### 4.2.6 <Other Component> Test
> Use this section only if the system requires Target Application. Otherwise add the content as NA.

<!--
> Example :
**Description:**
The test case shall be selected for validating <component> functionality by performing the below operations.

**Table 4.<NO>: <Other Component> Test**

| Sub Requirement ID | Requirement Description |
|-------------------|------------------------|
| <BOARD_ACRONYM>_TARGET_VIO_ENC_02_06 | <Component> **Description:** |

-->

---

#### 4.2.7 <Storage> Test
> Use this section only if the system requires Target Application. Otherwise add the content as NA.

<!--
> Example : 
**Table 4.<NO>: <Storage> Test Requirement**

| Si.No | Sub Requirement ID | Requirement Description |
|-------|-------------------|------------------------|
| 1 | <BOARD_ACRONYM>_TARGET_<STORAGE>_02_07 | <Storage> Test |

**Table 4.<NO>: <Storage> Test Sub Requirements**

| Si.No | Sub Requirement ID | Requirement Description |
|-------|-------------------|------------------------|
| 1 | <BOARD_ACRONYM>_TARGET_<STORAGE>_02_07_01 | Get <Storage>'s Product ID |
| 2 | <BOARD_ACRONYM>_TARGET_<STORAGE>_02_07_02 | <Storage> Read / Write Test |
| 3 | <BOARD_ACRONYM>_TARGET_<STORAGE>_02_07_03 | <Storage> Full Memory Test |
| 4 | <BOARD_ACRONYM>_TARGET_<STORAGE>_02_07_04 | <Storage> Chip Erase |
| 5 | <BOARD_ACRONYM>_TARGET_<STORAGE>_02_07_05 | Upload Board Details |
| 6 | <BOARD_ACRONYM>_TARGET_<STORAGE>_02_07_06 | <Storage> Data Retention Test |
-->
---

### 4.3 MCU Test
> Use this section only if the system requires MCU Application. Otherwise add the content as NA.

<!--
> Example :
**Description:**
In the <BOARD ID>, a MCU (<MCU MODEL>) is used for configuration and communication requirements. The MCU test cases will be performed by receiving command from the host application and transmit the status of the test as a response packet to the host application.

**Table 4.<NO>: MCU Test Requirement**

| Si.No | Sub Requirement ID | Requirement Description |
|-------|-------------------|------------------------|
| 1 | <BOARD_ACRONYM>_FW_03 | MCU Configuration Test |

**Table 4.<NO>: MCU Test Sub Requirement**

| Si.No | Sub Requirement ID | Requirement Description |
|-------|-------------------|------------------------|
| 1 | <BOARD_ACRONYM>_FW_<REQ_ACRONYM>_03_01 | <Interface Requirement Name> |
| 2 | <BOARD_ACRONYM>_FW_<REQ_ACRONYM>_03_02 | <Communication Requirement Name> |
.
...
-->
---

#### 4.<NO>.<NO> <Interface> Test
> Use this section only if the system requires <Interface Test> Application. Otherwise add the content as NA.
<!--
> Example :
**Table 4.<NO>: <Interface> Test Requirement**

| Si.No | Sub Requirement ID | Requirement Description |
|-------|-------------------|------------------------|
| 1 | <BOARD_ACRONYM>_FW_<INTERFACE>_03_05 | <Interface> Test |

**Table 4.<NO>: <Interface> Test Sub Requirement**

| Si.No | Sub Requirement ID | Requirement Description |
|-------|-------------------|------------------------|
| 1 | <BOARD_ACRONYM>_FW_<INTERFACE>_03_05_01 | <Interface> Configuration Write Test |
| 2 | <BOARD_ACRONYM>_FW_<INTERFACE>_03_05_02 | <Interface> Configuration Read Test |
| 3 | <BOARD_ACRONYM>_FW_<INTERFACE>_03_05_03 | <Interface> Read/Write Test |
-->
---

### 4.<NO> <Component> Test
> Use this section only if the system requires <Component Test> Application. Otherwise add the content as NA.

<!--
> Example :
**Description:**
The module has <COMPONENT NAME> for <functionality> operation.

**Table 4.<NO>: <Component> Test**

| Sub Requirement ID | Requirement Description |
|-------------------|------------------------|
| <BOARD_ACRONYM>_COMPONENT_04 | **Description:**
This test case shall be performed to validate the <functionality> from <component> chip. |
-->
---
