// Import necessary modules and functions
import { LightningElement, api, wire, track } from 'lwc';
import getCaseConfigs from '@salesforce/apex/ConfigController.getCaseConfigs'; // Apex method to get Case Configs
import sendCaseConfigs from '@salesforce/apex/ConfigController.sendCaseConfigs'; // Apex method to send Case Configs
import { ShowToastEvent } from 'lightning/platformShowToastEvent'; // Toast event to show messages
import { getRecord } from 'lightning/uiRecordApi'; // To get record data
import { refreshApex } from '@salesforce/apex'; // To refresh wired Apex methods

// Import Lightning Message Service and message channel
import { publish, subscribe, MessageContext } from 'lightning/messageService';
import CONFIG_UPDATES from '@salesforce/messageChannel/ConfigUpdates__c'; // Custom message channel

// Fields to fetch from the Case object
const CASE_FIELDS = ['Case.Status'];

export default class CaseConfigs extends LightningElement {
    @api recordId; // The Id of the Case record

    // Decorators to make properties reactive
    @track caseConfigs = []; // List of Case Configs
    @track selectedRowIds = []; // List of selected Case Config record IDs

    isSendDisabled = false; // Flag to disable/enable the 'Send' button
    caseStatus; // Status of the Case
    subscription = null; // To store LMS subscription
    wiredCaseResult; // Stores the result of the wired getRecord call
    wiredCaseConfigsResult; // Stores the result of the wired getCaseConfigs call
    tableKey = 0; // For forcing re-render of the datatable

    // Properties to track sorting
    sortedBy; // Field name to sort by
    sortedDirection = 'asc'; // Sorting direction ('asc' or 'desc')

    // Columns definition for the datatable
    columns = [
        { label: 'Label', fieldName: 'Label__c', sortable: true }, // Config Label column, sortable
        { label: 'Type', fieldName: 'Type__c', sortable: true }, // Config Type column, sortable
        {
            label: 'Amount',
            fieldName: 'Amount__c',
            type: 'currency',
            sortable: true,
            cellAttributes: { alignment: 'left' }, // Left align the Amount values
        },
    ];

    // Wire the MessageContext for Lightning Message Service
    @wire(MessageContext)
    messageContext;

    // Lifecycle hook to subscribe to message channel
    connectedCallback() {
        console.log('CaseConfigs component initialized with recordId:', this.recordId);
        this.subscribeToMessageChannel();
    }

    // Subscribe to the message channel
    subscribeToMessageChannel() {
        if (!this.subscription) {
            this.subscription = subscribe(
                this.messageContext,
                CONFIG_UPDATES,
                (message) => this.handleMessage(message)
            );
        }
    }

    // Handle messages received on the message channel
    handleMessage(message) {
        console.log('Message received in CaseConfigs:', message);
        if (message.recordId === this.recordId) {
            // Refresh data when message is received
            refreshApex(this.wiredCaseConfigsResult);
            refreshApex(this.wiredCaseResult);
            // Optional: Force re-render of the datatable
            this.tableKey += 1;
        }
    }

    // Get the Case record to check its status
    @wire(getRecord, { recordId: '$recordId', fields: CASE_FIELDS })
    wiredCase(result) {
        this.wiredCaseResult = result; // Store the wired result for refreshApex
        if (result.data) {
            // If data is returned, set the caseStatus and update the 'Send' button state
            this.caseStatus = result.data.fields.Status.value;
            this.isSendDisabled = this.caseStatus === 'Closed';
        } else if (result.error) {
            // Handle any errors
            this.handleError(result.error);
        }
    }

    // Get the list of Case Configs
    @wire(getCaseConfigs, { caseId: '$recordId' })
    wiredCaseConfigs(result) {
        this.wiredCaseConfigsResult = result; // Store the wired result for refreshApex
        if (result.data) {
            this.caseConfigs = result.data; // Set the caseConfigs data
        } else if (result.error) {
            // Handle any errors
            this.handleError(result.error);
        }
    }

    // Handle row selection in the datatable
    handleRowSelection(event) {
        const selectedRows = event.detail.selectedRows;
        // Map selected rows to their Ids
        this.selectedRowIds = selectedRows.map(row => row.Id);
    }

    // Handle the 'Send' button click
    handleSend() {
        // Call Apex method to send Case Configs
        sendCaseConfigs({ caseConfigIds: this.selectedRowIds })
            .then(() => {
                this.showToast('Success', 'Case Configs sent.', 'success');
                this.isSendDisabled = true;

                // Clear selected rows
                const datatable = this.template.querySelector('lightning-datatable');
                if (datatable) {
                    datatable.selectedRows = [];
                }
                this.selectedRowIds = [];

                // Publish message to notify other components
                this.publishConfigUpdate();

                // Refresh data
                return Promise.all([
                    refreshApex(this.wiredCaseConfigsResult),
                    refreshApex(this.wiredCaseResult),
                ]);
            })
            .then(() => {
                // Optional: Force re-render of the datatable
                this.tableKey += 1;
            })
            .catch((error) => {
                console.error('Error in handleSend:', error);
                // Handle any errors
                this.handleError(error);
            });
    }

    // Publish a message using Lightning Message Service
    publishConfigUpdate() {
        const message = {
            recordId: this.recordId,
            source: 'CaseConfigs',
        };
        console.log('Publishing message from CaseConfigs:', message);
        publish(this.messageContext, CONFIG_UPDATES, message);
    }

    // Handle errors and show a toast message
    handleError(error) {
        console.error('Error in CaseConfigs:', error);
        let message = 'An error occurred';
        if (error && error.body && error.body.message) {
            message = error.body.message;
        } else if (error && error.statusText) {
            message = error.statusText;
        } else if (error && error.message) {
            message = error.message;
        }
        this.showToast('Error', message, 'error');
    }

    // Utility method to show toast messages
    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant,
            })
        );
    }

    handleSort(event) {
        // Toggle sorting direction if clicking the same column
        this.sortedDirection = this.sortedBy === 'CreatedDate' && this.sortedDirection === 'asc' ? 'desc' : 'asc';
        this.sortedBy = 'CreatedDate'; // Always sort by CreatedDate
    
        this.sortData(this.sortedDirection);
    }
    
    sortData(sortDirection) {
        let dataCopy = [...this.caseConfigs]; // Make a copy of the configs array
    
        dataCopy.sort((a, b) => {
            let dateA = new Date(a.CreatedDate);
            let dateB = new Date(b.CreatedDate);
            return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
        });
    
        this.caseConfigs = [...dataCopy]; // Assign the sorted data back to trigger UI reactivity
    }
    
}