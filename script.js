document.addEventListener('DOMContentLoaded', () => {
    fetch('data.csv')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(csv => {
            const { headers, data } = parseCSV(csv); // Use the corrected parseCSV
            if (headers.length > 0 && data.length > 0) {
                originalData = data;
                csvHeaders = headers;
                // Define column types (adjust based on your actual data if needed)
                // These names MUST exactly match the headers from your CSV after cleaning
                numericColumns = [
                    'Max Range (M)', 'Max Length (mm)', 'Mid Length (mm)', 'Min Length (mm)',
                    'Flash (KB)', 'RAM (KB)', 'Reception Sensitivity (dBm)',
                    'Transmission Power (min, dBM)', 'Transmission Power (max, dBM)', // Note the space in "min, dBM" if it exists in header
                    'Current (TX, mA)', 'Current (RX, mA)', 'GPIO'
                ];
                textColumns = headers.filter(h => !numericColumns.includes(h));

                renderFilterTabs(headers);
                applyFiltersAndRender(); // Initial render
            } else {
                console.error("CSV parsing failed or file is empty/invalid.");
                document.getElementById('table-container').innerHTML = '<p>Error loading or parsing data.csv. Check console for details.</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching or processing data.csv:', error);
            document.getElementById('table-container').innerHTML = `<p>Error loading data: ${error.message}. Please check if data.csv exists and is accessible.</p>`;
        });

    // Add listener to close dropdowns when clicking outside
    document.addEventListener('click', (event) => {
        const target = event.target;
        // If the click is not on a tab and not inside a filter list, close all lists
        if (!target.closest('.tab') && !target.closest('.filter-list')) {
            closeAllFilterLists();
        }
    });
});

let originalData = [];
let csvHeaders = [];
let numericColumns = [];
let textColumns = [];
let filters = {}; // { header1: [value1, value2], header2: [value3] }

// --- CORRECTED parseCSV function ---
function parseCSV(csv) {
    const lines = csv.split('\n').filter(line => line.trim() !== ''); // Filter out empty lines
    if (lines.length === 0) return { headers: [], data: [] };

    // Helper function to trim and remove surrounding quotes (handles basic cases)
    const cleanField = (field) => {
        if (typeof field !== 'string') return field; // Return non-strings as is
        let cleaned = field.trim();
        // Remove surrounding quotes if they exist
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            cleaned = cleaned.substring(1, cleaned.length - 1);
            // Handle escaped double quotes ("") inside quoted fields -> "
             cleaned = cleaned.replace(/""/g, '"');
        }
        return cleaned;
    };

    // *** Use comma (,) as delimiter and apply cleanField ***
    const headers = lines[0].split(',').map(cleanField);
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        // *** Use comma (,) as delimiter and apply cleanField ***
        // Basic split by comma. Limitation: Won't correctly handle commas *inside* properly quoted fields
        // (e.g., "field1, with comma","field2"). For the provided data.csv, this seems okay.
        const values = lines[i].split(',').map(cleanField);

        if (values.length === headers.length) {
            const row = {};
            for (let j = 0; j < headers.length; j++) {
                 // Ensure header exists before assigning
                if (headers[j]) {
                     row[headers[j]] = values[j];
                } else {
                    console.warn(`Undefined header at index ${j} for line ${i + 1}`);
                }
            }
            data.push(row);
        } else {
            // Log detailed error for mismatch
             console.warn(`Skipping line ${i + 1}: Number of values (${values.length}) does not match number of headers (${headers.length}).\nHeaders: [${headers.join(', ')}]\nValues: [${values.join(', ')}]\nOriginal Line: ${lines[i]}`);
        }
    }
    // console.log("Parsed Headers:", headers); // Debugging: Check headers
    // console.log("Parsed Data Sample:", data.slice(0, 2)); // Debugging: Check first few data rows
    return { headers, data };
}
// --- END OF CORRECTED parseCSV function ---


function renderFilterTabs(headers) {
    const filterTabsContainer = document.getElementById('filter-tabs-container');
    filterTabsContainer.innerHTML = ''; // Clear previous tabs

    headers.forEach(header => {
        const tabWrapper = document.createElement('div');
        tabWrapper.classList.add('tab-wrapper');

        const tab = document.createElement('button'); // Use button for better accessibility
        tab.classList.add('tab');
        tab.textContent = header;
        tab.dataset.header = header; // Store header name

        const filterList = document.createElement('div'); // Use div for the list container
        filterList.classList.add('filter-list');
        filterList.style.display = 'none'; // Initially hidden
        filterList.innerHTML = '<ul></ul>'; // Add ul inside

        tab.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent document click listener from closing it immediately
            const currentlyOpen = filterList.style.display === 'block';
            closeAllFilterLists(); // Close others before opening/toggling
            if (!currentlyOpen) {
                populateFilterList(header, filterList.querySelector('ul'), filterData());
                filterList.style.display = 'block';
                tab.classList.add('active');
            } else {
                 tab.classList.remove('active'); // If it was open, just close it
            }
        });

        tabWrapper.appendChild(tab);
        tabWrapper.appendChild(filterList);
        filterTabsContainer.appendChild(tabWrapper);
    });
}

function closeAllFilterLists() {
    document.querySelectorAll('.filter-list').forEach(list => list.style.display = 'none');
    document.querySelectorAll('.tab.active').forEach(tab => tab.classList.remove('active'));
}

function populateFilterList(header, listElement, currentData) {
    listElement.innerHTML = ''; // Clear previous items
    let uniqueValues = new Set();

    currentData.forEach(item => {
        const value = item[header];
        // Handle cases where value might be undefined, null, or empty string
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            const valueStr = String(value).trim(); // Work with trimmed string
            if (header === 'Certification') {
                // Split by comma, trim, and add each non-empty part
                valueStr.split(',').map(v => v.trim()).filter(v => v).forEach(part => uniqueValues.add(part));
            } else {
                uniqueValues.add(valueStr);
            }
        }
    });

    let sortedValues = [...uniqueValues];

    // Sort numerically if it's a numeric column AND values look like numbers
    if (numericColumns.includes(header)) {
         // Attempt numeric sort, fall back to localeCompare if mixed types or errors
        try {
            sortedValues.sort((a, b) => {
                const numA = parseFloat(a);
                const numB = parseFloat(b);
                if (!isNaN(numA) && !isNaN(numB)) {
                    return numA - numB;
                }
                // If one or both are not numbers, use string comparison
                return String(a).localeCompare(String(b));
            });
        } catch (e) {
            console.warn(`Could not sort column "${header}" numerically, falling back to string sort. Error: ${e}`);
            sortedValues.sort((a, b) => String(a).localeCompare(String(b)));
        }
    } else {
        sortedValues.sort((a, b) => String(a).localeCompare(String(b))); // Sort alphabetically for text
    }

    // Get currently selected values for this header
    const selectedValues = filters[header] || [];

    sortedValues.forEach(value => {
        const listItem = document.createElement('li');
        listItem.textContent = value;
        listItem.dataset.value = value; // Store the value

        // Check if this value is currently selected
        if (selectedValues.includes(String(value))) { // Ensure comparison is consistent (string)
            listItem.classList.add('selected');
        }

        listItem.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent closing list immediately
            const clickedValue = String(event.target.dataset.value);
            const isSelected = event.target.classList.contains('selected');

            if (isSelected) {
                removeFilter(header, clickedValue);
                event.target.classList.remove('selected'); // Update UI immediately
            } else {
                addFilter(header, clickedValue);
                event.target.classList.add('selected'); // Update UI immediately
            }
            // Re-render table and selected filters, close list
            applyFiltersAndRender();
            closeAllFilterLists();
        });
        listElement.appendChild(listItem);
    });

     if (sortedValues.length === 0) {
        const noItems = document.createElement('li');
        noItems.textContent = 'No available options';
        noItems.style.fontStyle = 'italic';
        noItems.style.color = '#888';
        noItems.style.cursor = 'default';
        listElement.appendChild(noItems);
    }
}


function addFilter(header, value) {
    if (!filters[header]) {
        filters[header] = [];
    }
    // Add value only if it's not already present
    if (!filters[header].includes(value)) {
        filters[header].push(value);
        // No need to call rendering here, it's handled after click
    }
}

function removeFilter(header, value) {
    if (filters[header]) {
        filters[header] = filters[header].filter(item => item !== value);
        if (filters[header].length === 0) {
            delete filters[header]; // Remove header key if no values are selected
        }
        // No need to call rendering here, it's handled after click or tag removal
    }
}

function renderFilters() {
    const selectedFiltersContainer = document.getElementById('selected-filters-container');
    selectedFiltersContainer.innerHTML = ''; // Clear previous tags

    Object.entries(filters).forEach(([header, values]) => {
        values.forEach(value => {
            const filterTag = document.createElement('div');
            filterTag.classList.add('filter-tag');
            // Display format: "Header: Value"
            filterTag.textContent = `${header}: ${value}`;

            const removeButton = document.createElement('span');
            removeButton.classList.add('remove-filter');
            removeButton.textContent = '×'; // Use multiplication sign for better rendering
            removeButton.title = `Remove filter ${header}: ${value}`; // Tooltip
            removeButton.addEventListener('click', () => {
                removeFilter(header, value);
                applyFiltersAndRender(); // Re-apply filters and render everything
                closeAllFilterLists(); // Close lists after removing a filter tag
            });

            filterTag.appendChild(removeButton);
            selectedFiltersContainer.appendChild(filterTag);
        });
    });
}

function filterData() {
    let filteredData = [...originalData];

    Object.entries(filters).forEach(([header, selectedValues]) => {
        if (selectedValues.length === 0) return; // Skip if no values selected for this header

        filteredData = filteredData.filter(item => {
            const itemValue = item[header];
            if (itemValue === undefined || itemValue === null) return false; // Item doesn't have this property

            const itemValueStr = String(itemValue).trim(); // Work with trimmed strings

            if (header === 'Certification') {
                // Check if any part of the item's certification matches any selected value
                const parts = itemValueStr.split(',').map(v => v.trim()).filter(v => v); // Get non-empty parts
                // Return true if at least one selected value is found in the item's certification parts
                return selectedValues.some(selVal => parts.includes(selVal));
            } else {
                // Check if the item's value (as string) is included in the selected values for this header
                return selectedValues.includes(itemValueStr);
            }
        });
    });
    return filteredData;
}

function renderDataTable(data) {
    const table = document.getElementById('data-table');
    const tableHead = table.querySelector('thead');
    const tableBody = table.querySelector('tbody');
    const noDataMessage = document.getElementById('no-data-message');

    // Ensure elements exist before manipulating
    if (!table || !tableHead || !tableBody || !noDataMessage) {
        console.error("Table elements not found in the DOM!");
        return;
    }

    tableHead.innerHTML = ''; // Clear previous header
    tableBody.innerHTML = ''; // Clear previous body

    if (data.length === 0) {
        table.style.display = 'none';
        noDataMessage.style.display = 'block';
        return;
    }

    table.style.display = ''; // Ensure table is visible (use default display style)
    noDataMessage.style.display = 'none';

    // Create header row using the original order from csvHeaders
    const headerRow = document.createElement('tr');
    csvHeaders.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // Create data rows
    data.forEach(item => {
        const row = document.createElement('tr');
        csvHeaders.forEach(header => {
            const td = document.createElement('td');
            // Display value if it exists, otherwise empty string
            td.textContent = (item[header] !== undefined && item[header] !== null) ? item[header] : '';
            row.appendChild(td);
        });
        tableBody.appendChild(row);
    });
}

// Combined function to apply filters and update UI
function applyFiltersAndRender() {
    const currentFilteredData = filterData();
    renderFilters(); // Update the selected filter tags
    renderDataTable(currentFilteredData); // Update the data table
    // Note: Filter lists are populated on demand when a tab is clicked, using the latest filtered data
}
