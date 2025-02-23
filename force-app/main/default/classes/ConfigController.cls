public with sharing class ConfigController {
    
    // Wrapper class to hold the result of the addConfigsToCase method.
    public class AddConfigsResult {
        @AuraEnabled public Integer totalAdded;  // Number of records successfully added
        @AuraEnabled public Integer totalDuplicates;  // Number of duplicate records found
        @AuraEnabled public String message;  // Success or error message

        // Constructor to initialize the result object
        public AddConfigsResult(Integer totalAdded, Integer totalDuplicates, String message) {
            this.totalAdded = totalAdded;
            this.totalDuplicates = totalDuplicates;
            this.message = message;
        }
    }
    
    /**
     * Retrieves a paginated list of available configurations.
     * This method is cacheable for better performance.
     *
     * @param caseId       The Case record ID
     * @param limitSize    Number of records to return (pagination)
     * @param offsetSize   Offset for pagination (for fetching the next set of records)
     * @return List of Config__c records sorted by CreatedDate
     */
    @AuraEnabled(cacheable=true)
    public static List<Config__c> getAvailableConfigs(Id caseId, Integer limitSize, Integer offsetSize) {
        return [
            SELECT Id, Label__c, Type__c, Amount__c, CreatedDate
            FROM Config__c ORDER BY CreatedDate
            LIMIT :limitSize OFFSET :offsetSize
        ];
    }
    
    /**
     * Gets the count of available configurations that are NOT already linked to the given Case.
     * This method filters out configurations that have already been added to the Case.
     *
     * @param caseId The Case record ID
     * @return Integer count of available configurations
     */
    @AuraEnabled(cacheable=true)
    public static Integer getAvailableConfigsCount(Id caseId) {
        // Count Configs that are NOT already linked to the Case
        Integer totalCount = [SELECT COUNT() FROM Config__c];
        return totalCount;
    }

    /**
     * Adds selected Config__c records to a given Case.
     * Checks for duplicates before adding new records.
     *
     * @param caseId   The Case record ID
     * @param configIds List of Config__c record IDs to be added
     * @return AddConfigsResult - Object containing totalAdded, totalDuplicates, and message
     */
    @AuraEnabled
    public static AddConfigsResult addConfigsToCase(Id caseId, List<Id> configIds) {
        // Fetch existing Case Config records to avoid duplicates
        Set<String> existingLabels = new Set<String>();
        for (Case_Config__c cc : [
            SELECT Label__c
            FROM Case_Config__c
            WHERE Case__c = :caseId
        ]) {
            existingLabels.add(cc.Label__c);
        }

        List<Case_Config__c> caseConfigsToInsert = new List<Case_Config__c>(); // Holds new records
        List<String> duplicateLabels = new List<String>(); // Stores duplicate labels

        // Fetch the selected Config__c records
        List<Config__c> configs = [
            SELECT Label__c, Type__c, Amount__c
            FROM Config__c
            WHERE Id IN :configIds
        ];

        // Check each config and avoid duplicates
        for (Config__c config : configs) {
            if (existingLabels.contains(config.Label__c)) {
                duplicateLabels.add(config.Label__c);
            } else {
                Case_Config__c cc = new Case_Config__c();
                cc.Label__c = config.Label__c;
                cc.Type__c = config.Type__c;
                cc.Amount__c = config.Amount__c;
                cc.Case__c = caseId;
                caseConfigsToInsert.add(cc);
            }
        }

        Integer totalAdded = 0;
        Integer totalDuplicates = duplicateLabels.size();
        String message;

        // Insert new Case_Config__c records if available
        if (!caseConfigsToInsert.isEmpty()) {
            insert caseConfigsToInsert;
            totalAdded = caseConfigsToInsert.size();
        }

        // Prepare success or duplicate messages
        if (totalAdded > 0 && totalDuplicates > 0) {
            message = 'Records added, duplicate records were not added: ' + String.join(duplicateLabels, ', ');
        } else if (totalAdded > 0) {
            message = 'All records added successfully.';
        } else {
            message = 'No records were added. All selected configs are already added to the Case.';
        }

        return new AddConfigsResult(totalAdded, totalDuplicates, message);
    }

    /**
     * Retrieves all Case_Config__c records linked to a specific Case.
     *
     * @param caseId The Case record ID
     * @return List of Case_Config__c records
     */
    @AuraEnabled(cacheable=true)
    public static List<Case_Config__c> getCaseConfigs(Id caseId) {
        return [SELECT Id, Label__c, Type__c, Amount__c, CreatedDate
                FROM Case_Config__c
                WHERE Case__c = :caseId Order By CreatedDate];
    }

    /**
     * Sends Case configuration data to an external system via HTTP callout.
     * If successful, updates the Case status to 'Closed'.
     *
     * @param caseId The Case record ID
     * @throws AuraHandledException if the Case is already closed or callout fails
     */
    @AuraEnabled
public static void sendCaseConfigs(List<Id> caseConfigIds) {
    // Fetch the Case_Config__c records based on the selected IDs
    List<Case_Config__c> selectedConfigs = [SELECT Id, Amount__c, Type__c, Label__c, Case__c FROM Case_Config__c WHERE Id IN :caseConfigIds];

    if (selectedConfigs.isEmpty()) {
        throw new AuraHandledException('No Case Configs selected.');
    }

    // Prepare API endpoint
    String endpoint = 'https://requestcatcher.com';

    // Prepare payload data
    Map<String, Object> payload = new Map<String, Object> {
        'caseConfigs' => new List<Map<String, Object>>(),
        'status' => 'Closed',
        'caseId' => selectedConfigs[0].Case__c // Use the Case ID from the first selected config
    };

    // Convert Case_Config__c records into JSON format
    for (Case_Config__c cc : selectedConfigs) {
        Map<String, Object> configData = new Map<String, Object> {
            'amount' => cc.Amount__c,
            'type' => cc.Type__c,
            'label' => cc.Label__c
        };
        ((List<Map<String, Object>>)payload.get('caseConfigs')).add(configData);
    }

    // Serialize the payload to JSON
    String jsonPayload = JSON.serialize(payload);
    System.debug('jsonPayload ---->' + jsonPayload);

    // Perform HTTP callout
    HttpRequest req = new HttpRequest();
    req.setEndpoint(endpoint);
    req.setMethod('POST');
    req.setHeader('Content-Type', 'application/json');
    req.setBody(jsonPayload);

    Http http = new Http();
    HttpResponse res = http.send(req);

    // Handle response
    if (res.getStatusCode() == 200) {
        // If successful, update the Case status to 'Closed'
        Case caseToUpdate = [SELECT Id, Status FROM Case WHERE Id = :selectedConfigs[0].Case__c LIMIT 1];
        caseToUpdate.Status = 'Closed';

        update caseToUpdate; // Update the Case status
    } else {
        throw new AuraHandledException('Error sending data: ' + res.getStatus());
    }
}
}