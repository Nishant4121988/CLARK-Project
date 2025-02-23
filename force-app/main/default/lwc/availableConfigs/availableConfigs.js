import { LightningElement, api, wire, track } from 'lwc'; // Importing necessary modules from LWC
import getAvailableConfigs from '@salesforce/apex/ConfigController.getAvailableConfigs'; // Apex method to fetch available configs
import getAvailableConfigsCount from '@salesforce/apex/ConfigController.getAvailableConfigsCount'; // Apex method to fetch count of available configs
import addConfigsToCase from '@salesforce/apex/ConfigController.addConfigsToCase'; // Apex method to add selected configs to the case
import { ShowToastEvent } from 'lightning/platformShowToastEvent'; // For showing toast messages
import { getRecord } from 'lightning/uiRecordApi'; // For retrieving record data
import { publish, MessageContext } from 'lightning/messageService'; // For publishing messages using LWC message service
import CONFIG_UPDATES from '@salesforce/messageChannel/ConfigUpdates__c'; // Message Channel to communicate updates

const CASE_FIELDS = ['Case.Status']; // Fields to fetch for the case record (Case Status)
const PAGE_SIZE = 10; // Default page size for pagination

export default class AvailableConfigs extends LightningElement {
    @api recordId; // Record ID for the current case
    @track configs = []; // Array to store available configs
    @track totalRecords = 0; // Total number of records available
    @track currentPage = 1; // Current page in pagination
    @track totalPages = 1; // Total pages in pagination
    pageSize = PAGE_SIZE; // Set page size

    selectedConfigIds = []; // Array to store IDs of selected configs
    isAddDisabled = true; // Flag to disable "Add" button
    caseStatus; // Stores the status of the case

    // Sorting properties
    sortedBy; // Field used for sorting
    sortedDirection = 'asc'; // Sort direction (ascending)

    columns = [
        { label: 'Label', fieldName: 'Label__c', sortable: true }, // Columns definition for the datatable
        { label: 'Type', fieldName: 'Type__c', sortable: true },
        {
            label: 'Amount',
            fieldName: 'Amount__c',
            type: 'currency',
            sortable: true,
            cellAttributes: { alignment: 'left' }, // Left-align currency
        },
    ];

    @wire(MessageContext) messageContext; // Message context to publish messages

    // Wire the case data using the getRecord wire adapter
    @wire(getRecord, { recordId: '$recordId', fields: CASE_FIELDS })
    wiredCase({ error, data }) {
        if (data) {
            // If data is available, extract case status and set isAddDisabled based on case status
            this.caseStatus = data.fields.Status.value;
            this.isAddDisabled = this.caseStatus === 'Closed' || this.selectedConfigIds.length === 0;
        } else if (error) {
            this.handleError(error); // Handle error if any
        }
    }

    // Fetch the total number of records when component is initialized
    connectedCallback() {
        this.fetchTotalRecords(); // Fetch the total available records
    }

    // Getter to check if the previous button should be disabled (when on first page)
    get isPrevDisabled() {
        return this.currentPage <= 1;
    }

    // Getter to check if the next button should be disabled (when on last page)
    get isNextDisabled() {
        return this.currentPage >= this.totalPages;
    }

    // Fetch the total number of available records
    fetchTotalRecords() {
        getAvailableConfigsCount({ caseId: this.recordId })
            .then((result) => {
                this.totalRecords = result; // Total records count
                this.totalPages = Math.ceil(this.totalRecords / this.pageSize) || 1; // Total pages calculation
                this.fetchConfigs(); // Fetch the available configs after determining total pages
            })
            .catch((error) => {
                this.handleError(error); // Handle error if any
            });
    }

    // Fetch available configurations based on the current page
    fetchConfigs() {
        const offset = (this.currentPage - 1) * this.pageSize; // Calculate offset for pagination
        getAvailableConfigs({
            caseId: this.recordId,
            limitSize: this.pageSize,
            offsetSize: offset,
        })
            .then((result) => {
                this.configs = result; // Store fetched configs
                // Apply previous sorting if any
                if (this.sortedBy) {
                    this.sortData(this.sortedBy, this.sortedDirection); // Sort fetched configs based on previous sorting
                }
            })
            .catch((error) => {
                this.handleError(error); // Handle error if any
            });
    }

    // Handle row selection in the datatable
    handleRowSelection(event) {
        const selectedRows = event.detail.selectedRows; // Get selected rows
        this.selectedConfigIds = selectedRows.map((row) => row.Id); // Store selected config IDs
        this.isAddDisabled = this.selectedConfigIds.length === 0 || this.caseStatus === 'Closed'; // Disable "Add" button if no selection or case is closed
    }

    // Add selected configurations to the case
    handleAdd() {
        addConfigsToCase({ caseId: this.recordId, configIds: this.selectedConfigIds })
            .then((result) => {
                this.showToast('Info', result.message, 'info'); // Show success toast message
                const datatable = this.template.querySelector('lightning-datatable'); // Clear selected rows from datatable
                if (datatable) {
                    datatable.selectedRows = [];
                }
                this.selectedConfigIds = []; // Reset selected config IDs
                this.isAddDisabled = true; // Disable "Add" button again
                this.fetchTotalRecords(); // Refresh total records and configs after adding
                this.publishConfigUpdate(); // Publish config update message
            })
            .catch((error) => {
                this.handleError(error); // Handle error if any
            });
    }

    // Publish an update message about the config addition
    publishConfigUpdate() {
        const message = {
            recordId: this.recordId,
            source: 'AvailableConfigs', // Source of the update message
        };
        publish(this.messageContext, CONFIG_UPDATES, message); // Publish message to message channel
    }

    handleSort() {
        let sortDirection = this.sortedDirection === 'asc' ? 'desc' : 'asc'; // Toggle sorting direction
        this.sortedDirection = sortDirection; // Store the new sorting direction
        this.sortData(sortDirection); // Always sort by CreatedDate
    }
    
    // Always sort based on CreatedDate
    sortData(sortDirection) {
        let dataCopy = [...this.configs]; // Make a copy of the configs array
    
        dataCopy.sort((a, b) => {
            let dateA = new Date(a.CreatedDate);
            let dateB = new Date(b.CreatedDate);
            return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
        });
    
        this.configs = [...dataCopy]; // Assign the sorted data back to trigger UI reactivity
    }
    
    
    /*
    // Handle sorting event for the datatable
    handleSort(event) {
        const { fieldName } = event.detail;
        let sortDirection = this.sortedDirection === 'asc' ? 'desc' : 'asc'; // Toggle sorting direction
    
        this.sortedBy = fieldName; // Store the sorted field name
        this.sortedDirection = sortDirection; // Store the new sorting direction
    
        this.sortData(fieldName, sortDirection); // Sort data based on the selected field and direction
    }

    // Sort the data based on the field and direction
    sortData(fieldName, sortDirection) {
        let dataCopy = [...this.configs]; // Make a copy of the configs array to avoid direct mutation

        dataCopy.sort((a, b) => {
            let valueA = a[fieldName]; // Get value of the field for row A
            let valueB = b[fieldName]; // Get value of the field for row B

            // Handle null or undefined values
            valueA = valueA !== undefined && valueA !== null ? valueA : '';
            valueB = valueB !== undefined && valueB !== null ? valueB : '';

            let result = 0;

            // Numeric sorting for number fields like Amount__c
            if (!isNaN(valueA) && !isNaN(valueB)) {
                result = parseFloat(valueA) - parseFloat(valueB);
            } else if (typeof valueA === 'string' && typeof valueB === 'string') {
                // Special handling for strings containing numbers (e.g., "Config 10")
                const numberA = valueA.match(/\d+/) ? parseInt(valueA.match(/\d+/)[0], 10) : 0;
                const numberB = valueB.match(/\d+/) ? parseInt(valueB.match(/\d+/)[0], 10) : 0;

                if (numberA && numberB) {
                    result = numberA - numberB; // Compare numbers numerically
                } else {
                    result = valueA.localeCompare(valueB, undefined, { numeric: true, sensitivity: 'base' });
                }
            } else {
                result = valueA.toString().localeCompare(valueB.toString(), undefined, { numeric: true, sensitivity: 'base' });
            }

            return sortDirection === 'asc' ? result : -result;
        });

        this.configs = [...dataCopy]; // Assign the sorted data back to trigger UI reactivity
    }
        */

    // Go to the next page for pagination
    handleNextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++; // Increment current page
            this.fetchConfigs(); // Fetch configs for the new page
        }
    }

    // Go to the previous page for pagination
    handlePrevPage() {
        if (this.currentPage > 1) {
            this.currentPage--; // Decrement current page
            this.fetchConfigs(); // Fetch configs for the new page
        }
    }

    // Handle any errors and display an error message
    handleError(error) {
        console.error('Error in AvailableConfigs:', error); // Log error to console
        let message = 'An error occurred'; // Default error message
        if (error?.body?.message) {
            message = error.body.message; // Use message from error body if available
        } else if (error?.message) {
            message = error.message; // Use message from error if available
        }
        this.showToast('Error', message, 'error'); // Show error toast message
    }

    // Show toast messages for success or error
    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title, // Title of the toast
                message, // Message of the toast
                variant, // Type of the toast (success, error, info, etc.)
            }),
        );
    }
}