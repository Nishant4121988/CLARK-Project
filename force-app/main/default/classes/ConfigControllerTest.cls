@isTest
private class ConfigControllerTest {

    /**
     * @testSetup method to create test data before running test cases.
     * This method runs once per test execution, setting up necessary records.
     */
    @testSetup
    static void setupTestData() {
        // Create a test Case record
        Case testCase = new Case(Subject = 'Test Case');
        insert testCase;

        // Create multiple Config__c records to simulate available configurations
        List<Config__c> configRecords = new List<Config__c>();
        for (Integer i = 1; i <= 5; i++) {
            configRecords.add(new Config__c(
                Label__c = 'Config ' + i,
                Type__c = 'Type ' + i,
                Amount__c = 100 * i
            ));
        }
        insert configRecords;

        // Create a Case_Config__c record linked to the Case to simulate an existing configuration
        Case_Config__c caseConfig = new Case_Config__c(
            Label__c = 'Config 1',  // This simulates an existing config linked to the Case
            Type__c = 'Type 1',
            Amount__c = 100,
            Case__c = testCase.Id
        );
        insert caseConfig;
    }

    /**
     * Test case to validate the retrieval of available Config__c records.
     * This tests if `getAvailableConfigs` correctly fetches Config__c records.
     */
    static testMethod void testGetAvailableConfigs() {
        // Retrieve the test Case
        Case testCase = [SELECT Id FROM Case WHERE Subject = 'Test Case' LIMIT 1];

        // Call the method with a limit and offset
        List<Config__c> availableConfigs = ConfigController.getAvailableConfigs(testCase.Id, 10, 0);

        // The method should return all 5 Config__c records
        System.assertEquals(5, availableConfigs.size(), 'Should return 5 available Configs');
    }

    /**
     * Test case to check if the count of available Configs is calculated correctly.
     */
    static testMethod void testGetAvailableConfigsCount() {
        // Retrieve the test Case
        Case testCase = [SELECT Id FROM Case WHERE Subject = 'Test Case' LIMIT 1];

        // Call the method to count available Configs
        Integer count = ConfigController.getAvailableConfigsCount(testCase.Id);

        // Since 'Config 1' is already linked, it should return count as 5
        System.assertEquals(5, count, 'Available Configs count should be 5');
    }

    /**
     * Test case to validate adding Configs to a Case without duplicates.
     */
    static testMethod void testAddConfigsToCase_NoDuplicates() {
        // Retrieve the test Case
        Case testCase = [SELECT Id FROM Case WHERE Subject = 'Test Case' LIMIT 1];

        // Get all Config__c records except 'Config 1' (which is already linked)
        List<Config__c> availableConfigs = [SELECT Id, Label__c FROM Config__c WHERE Label__c != 'Config 1'];

        // Collect Config IDs to be added to the Case
        List<Id> configIds = new List<Id>();
        for (Config__c config : availableConfigs) {
            configIds.add(config.Id);
        }

        // Call the method to add Configs to the Case
        Test.startTest();
        ConfigController.AddConfigsResult result = ConfigController.addConfigsToCase(testCase.Id, configIds);
        Test.stopTest();

        // Verify that 4 records were added successfully
        System.assertEquals(4, result.totalAdded, 'Should have added 4 Configs');
        System.assertEquals(0, result.totalDuplicates, 'Should have 0 duplicates');
        System.assertEquals('All records added successfully.', result.message);

        // Verify the total number of Case_Config__c records (1 existing + 4 added = 5)
        List<Case_Config__c> caseConfigs = [SELECT Id FROM Case_Config__c WHERE Case__c = :testCase.Id];
        System.assertEquals(5, caseConfigs.size(), 'Total Case Configs should be 5');
    }

    /**
     * Test case to verify that duplicates are not added when calling addConfigsToCase.
     */
    static testMethod void testAddConfigsToCase_WithDuplicates() {
        // Retrieve the test Case
        Case testCase = [SELECT Id FROM Case WHERE Subject = 'Test Case' LIMIT 1];

        // Get already added Case_Config__c labels
        List<Case_Config__c> existingConfigs = [SELECT Label__c FROM Case_Config__c];
        Set<String> existingConfigLabels = new Set<String>();
        for (Case_Config__c cc : existingConfigs) {
            existingConfigLabels.add(cc.Label__c);
        }

        // Retrieve Config__c records that match existing Case_Config__c labels (duplicates)
        List<Config__c> duplicateConfigs = [SELECT Id FROM Config__c WHERE Label__c IN :existingConfigLabels];

        // Collect Config IDs
        List<Id> configIds = new List<Id>();
        for (Config__c config : duplicateConfigs) {
            configIds.add(config.Id);
        }

        // Call the method to add Configs to Case (which should result in duplicates)
        Test.startTest();
        ConfigController.AddConfigsResult result = ConfigController.addConfigsToCase(testCase.Id, configIds);
        Test.stopTest();

        // Since these are duplicates, they should not be added
        System.assertEquals(0, result.totalAdded, 'Should have added 0 Configs due to duplicates');
        System.assertEquals(1, result.totalDuplicates, 'Should have 1 duplicate Config');
        System.assertEquals('No records were added. All selected configs are already added to the Case.', result.message);
    }

    /**
     * Test case to check retrieval of Case_Config__c records.
     */
    static testMethod void testGetCaseConfigs() {
        // Retrieve the test Case
        Case testCase = [SELECT Id FROM Case WHERE Subject = 'Test Case' LIMIT 1];

        // Call the method to fetch Case_Config__c records
        List<Case_Config__c> caseConfigs = ConfigController.getCaseConfigs(testCase.Id);

        // Initially, there should be 1 Case_Config__c record
        System.assertEquals(1, caseConfigs.size(), 'Should have 1 initial Case Config');
    }

    /**
     * Test case to validate successful execution of sendCaseConfigs.
     */
    static testMethod void testSendCaseConfigs_Success() {
        // Retrieve the test Case
        Case testCase = [SELECT Id, Status FROM Case WHERE Subject = 'Test Case' LIMIT 1];

        // Create a test Case_Config__c record associated with the test Case
        Case_Config__c testConfig = new Case_Config__c(
            Case__c = testCase.Id,
            Amount__c = 100.0,
            Type__c = 'Test Type',
            Label__c = 'Test Label'
        );
        insert testConfig;

        // Mock HTTP callout for success response
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(200, '{"message":"Success"}'));

        // Start test context
        Test.startTest();

        // Call the sendCaseConfigs method and pass the selected Case_Config__c Ids
        ConfigController.sendCaseConfigs(new List<Id>{testConfig.Id});

        // Stop test context
        Test.stopTest();

        // Verify that the Case status is updated to 'Closed'
        testCase = [SELECT Status FROM Case WHERE Id = :testCase.Id];
        System.assertEquals('Closed', testCase.Status);
    }

    /**
     * Mock HTTP Response Generator for testing API callouts.
     */
    private class MockHttpResponseGenerator implements HttpCalloutMock {
        private Integer statusCode;
        private String responseBody;

        public MockHttpResponseGenerator(Integer statusCode, String responseBody) {
            this.statusCode = statusCode;
            this.responseBody = responseBody;
        }

        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(statusCode);
            res.setBody(responseBody);
            return res;
        }
    }
}