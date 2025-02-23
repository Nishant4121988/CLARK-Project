Overview

This is a custom solution built for Salesforce that aims to boost productivity for consultants by enabling them to add Config records directly to a Case without leaving the Case detail page. It introduces two custom related lists to the Case page:
·Available Configs: Displays all available Config records.
·Case Configs: Shows the Configs that have been added to the current Case.

By streamlining the process of adding and managing Configs directly from the Case page, this tool saves valuable time and increases efficiency.
Features
·Seamless Config Addition: Easily add one or multiple Config records to a Case directly from the Case page.
·Instant Updates: Any newly added Configs appear immediately in the Case Configs list—no page refresh needed.
·Duplicate Prevention: Configs that are already linked to the Case cannot be added again, avoiding duplicates.
·One-Click Send: Close the Case and send Case Config data to an external service with just one click.
·Error Handling: Handles responses from external services appropriately, including non-200 HTTP responses.


Installation
Prerequisites
·Salesforce Developer Edition or Scratch Org.
·Salesforce CLI installed.
·Visual Studio Code with Salesforce Extensions Pack.

1.Update Remote Site Settings:
 The Remote Site Setting is included in the repository.
 Ensure the endpoint URL in the ConfigController Apex class matches the URL generated from RequestCatcher.

2.Set Up the FlexiPage for Case:
 The FlexiPage layout for the Case object is included.
 Make sure that both Available Configs and Case Configs components are added to the Case Lightning page.

Usage
1. Available Configs Component
·Navigate to any Case record.
·In the Available Configs related list:
 View all available Config records listed with columns such as Label, Type, and Amount.
 Select one or multiple Config records to add to the Case.
 Click the Add button to add selected Configs.
 The selected Configs will appear in the Case Configs list.
 New records are saved to the database, and Configs already added to the Case are disabled to prevent duplicates.

2. Case Configs Component
·Displays the Config records that have been added to the current Case.
·Columns displayed: Label, Type, and Amount.
·Newly added Configs will appear automatically without needing to refresh the page.
·Click the Send button to:
 Close the Case and update the status to "Closed".
 Send the Case and its Configs data to an external service.
·After sending, the ability to add new Configs is disabled, and the Send button is disabled.

Components Included
Custom Objects and Fields:
·Config__c: Custom object with fields:
 Label (Text, Unique)
 Type (Text)
 Amount (Number)

·Case_Config__c: Custom object with fields:
 Label (Text, Unique)
 Type (Text)
 Amount (Number)
 Case (Lookup to Case object)


Remote Site Setting:
·Pre-configured to allow callouts to the external service endpoint.
FlexiPage for Case:
·Lightning Flexi Page for the Case object, which includes the custom components.

Lightning Web Components:
·AvailableConfigs: Manages the display and selection of available Config records.
·CaseConfigs: Displays Configs added to the Case and handles the Send functionality.

MessageChannel : ConfigUpdates.messageChannel-meta.xml (for an interaction between the components).

Apex Classes and Test Classes:
·ConfigController: Apex class that handles server-side logic and external service callouts.
·ConfigControllerTest: Apex test class covering at least 85% of the ConfigController class for code coverage.

API Integration
Endpoint
·Generated using RequestCatcher (https://requestcatcher.com/).

Request Method
·POST
Request Payload Structure
json
{
  "caseId": "50068000005QOhbAAG",
  "status": "Closed",
  "caseConfigs": [
    {
      "label": "Test Label",
      "type": "Test Type",
      "amount": 10.00
    }
  ]
}

Response Handling
·200 OK: Success response.
·Non-200 Responses: Handled as errors and appropriately managed in the Apex code.


Implementation Details
·Uses Apex HTTP callouts in the ConfigController class.
·Errors are managed with proper try-catch blocks.
·Remote Site Settings have been configured to allow external callouts.

Testing
·Apex test coverage is at least 85% for the ConfigController class.
·ConfigControllerTest includes tests for:
 Adding Config records to a Case.
 Sending data to the external service .

Optional Features
·Sorting Records: Users can sort records by any column in both the Available Configs and Case Configs components.
·Pagination: The Available Configs component includes pagination to handle large datasets efficiently.

Task Breakdown
·Custom Objects and Fields: Created Config__c and Case_Config__c objects with the necessary fields.
·Lightning Web Components:
 AvailableConfigs: Displays available Config records, allows multi-select, and adds Configs to Cases while preventing duplicates.
 CaseConfigs: Displays Configs already added to the Case and includes the Send button.
·Apex Classes: The ConfigController handles the retrieval of Config records, manages the external service callout, and processes the Send button functionality.

·External Service Integration: Configured the Remote Site Settings and generated the endpoint via RequestCatcher.

·Apex Test Class: The ConfigControllerTest ensures the critical functionalities are covered and tests all important use cases.

·Optional Features: Sorting and pagination are included to enhance the usability of the components.

·FlexiPage: The custom components are added to the Case Lightning page layout.

Notes
Error Handling
·All exceptions are properly caught, with user-friendly error messages displayed where needed.
·The UI prevents any actions that might lead to errors, such as adding duplicate Configs.

Governance Considerations
·SOQL queries and DML operations are optimized for bulk operations.
·The code respects platform limits to ensure scalability.

Security
·The app follows Salesforce's best practices.
·Apex classes ensure that appropriate sharing settings are enforced.

Feedback
We would love to hear from you! Please use this README for any feedback or questions regarding the project.
