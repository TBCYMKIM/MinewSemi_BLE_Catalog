document.addEventListener('DOMContentLoaded', () => {
    fetch('data.csv')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(csv => {
            console.log("CSV data fetched successfully.");
            const { headers, data } = parseCSV(csv);
            if (headers.length > 0 && data.length > 0) {
                originalData = data;
                csvHeaders = headers;
                console.log(`CSV Parsed: ${headers.length} headers found.`, headers);

                numericColumns = [
                    'Max Range (M)', 'Max Length (mm)', 'Mid Length (mm)', 'Min Length (mm)',
                    'Flash (KB)', 'RAM (KB)', 'Reception Sensitivity (dBm)',
                    'Transmission Power (min, dBM)', 'Transmission Power (max, dBM)',
                    'Current (TX, mA)', 'Current (RX, mA)', 'GPIO'
                ];
                textColumns = headers.filter(h => !numericColumns.includes(h));

                renderFilterTabs(headers);
                applyFiltersAndRender(); // Initial render
            } else {
                console.error("CSV parsing failed or file is empty/invalid. Headers count:", headers.length, "Data count:", data.length);
                document.getElementById('table-container').innerHTML = '<p>Error loading or parsing data.csv. Check console for details.</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching or processing data.csv:', error);
            document.getElementById('table-container').innerHTML = `<p>Error loading data: ${error.message}. Please check if data.csv exists and is accessible.</p>`;
        });

    // --- MODIFIED Document Click Listener ---
    document.addEventListener('click', (event) => {
        const target = event.target;
        // Check if the click is outside any tab button AND outside any filter list
        if (!target.closest('.tab') && !target.closest('.filter-list')) {
            // Check if any list was actually open before closing
            const wasListOpen = document.querySelector('.filter-list[style*="display: block"]');
            if (wasListOpen) {
                console.log("Clicked outside: Applying filters before closing lists.");
                applyFiltersAndRender(); // Apply filters when closing via outside click
            }
            closeAllFilterLists(); // Close all lists
        }
    });
    // --- END MODIFIED Document Click Listener ---
});

let originalData = [];
let csvHeaders = [];
let numericColumns = [];
let textColumns = [];
let filters = {};

// --- parseCSV function (using Regex - same as previous version) ---
function parseCSV(csv) {
    const lines = csv.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) {
        console.warn("parseCSV: Input CSV string is empty or contains only whitespace.");
        return { headers: [], data: [] };
    }
    const regex = /("([^"]*(?:""[^"]*)*)"|[^",]+)(?=\s*,|\s*$)/g;
    const cleanField = (field) => {
        if (typeof field !== 'string') return field;
        let cleaned = field.trim();
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            cleaned = cleaned.substring(1, cleaned.length - 1).replace(/""/g, '"');
        }
        return cleaned;
    };
    const parseLine = (line, lineNumber) => {
        const fields = [];
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(line)) !== null) {
            fields.push(cleanField(match[1]));
        }
        if (line.trim().endsWith(',')) fields.push('');
        return fields;
    };
    const headers = parseLine(lines[0], 1);
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i], i + 1);
        if (values.length === headers.length) {
            const row = {};
            for (let j = 0; j < headers.length; j++) {
                if (headers[j] !== undefined && headers[j] !== null && headers[j] !== '') {
                    row[headers[j]] = values[j];
                } else {
                     console.warn(`parseCSV: Invalid or empty header at index ${j} on line 1.`);
                }
            }
            data.push(row);
        } else if (values.length > 0) {
             console.warn(`parseCSV: Skipping line ${i + 1}. Values (${values.length}) != Headers (${headers.length}). Line: ${lines[i]}`);
        }
    }
    return { headers, data };
}
// --- END OF parseCSV function ---


function renderFilterTabs(headers) {
    const filterTabsContainer = document.getElementById('filter-tabs-container');
    filterTabsContainer.innerHTML = '';
    console.log(`renderFilterTabs: Starting to render ${headers.length} tabs.`);

    headers.forEach((header, index) => {
        if (!header || typeof header !== 'string' || header.trim() === '') {
            console.warn(`renderFilterTabs: Skipping tab for invalid header at index ${index}:`, header);
            return;
        }

        const tabWrapper = document.createElement('div');
        tabWrapper.classList.add('tab-wrapper');

        const tab = document.createElement('button');
        tab.classList.add('tab');
        tab.textContent = header;
        tab.dataset.header = header;

        const filterList = document.createElement('div');
        filterList.classList.add('filter-list');
        filterList.style.display = 'none';
        filterList.innerHTML = '<ul></ul>';

        // --- MODIFIED Tab Click Listener ---
        tab.addEventListener('click', (event) => {
            event.stopPropagation(); // Important: prevent triggering document click listener
            const listUl = filterList.querySelector('ul');
            if (!listUl) {
                console.error("Could not find UL element for header:", header);
                return;
            }
            const isCurrentlyOpen = filterList.style.display === 'block';

            if (isCurrentlyOpen) {
                // If it's open, close it and APPLY filters
                console.log(`Tab clicked [${header}]: Closing list and applying filters.`);
                filterList.style.display = 'none';
                tab.classList.remove('active');
                applyFiltersAndRender(); // Apply filters now
            } else {
                // If it's closed, close OTHERS (without applying filters), then open this one
                console.log(`Tab clicked [${header}]: Opening list.`);
                closeAllFilterLists(filterList); // Close others, excluding the current list
                populateFilterList(header, listUl, filterData()); // Populate with current data
                filterList.style.display = 'block';
                tab.classList.add('active');
            }
        });
        // --- END MODIFIED Tab Click Listener ---

        tabWrapper.appendChild(tab);
        tabWrapper.appendChild(filterList);
        filterTabsContainer.appendChild(tabWrapper);
    });
    console.log("renderFilterTabs: Finished rendering tabs.");
}

// --- MODIFIED closeAllFilterLists function ---
function closeAllFilterLists(excludeList = null) {
    // console.log("closeAllFilterLists called, excluding:", excludeList);
    document.querySelectorAll('.filter-list').forEach(list => {
        if (list !== excludeList) {
            if (list.style.display === 'block') {
                 // console.log("Closing list:", list);
                 list.style.display = 'none';
                 // Find the corresponding tab button and remove 'active' class
                 const correspondingTab = list.previousElementSibling; // Assumes button is direct sibling before list
                 if (correspondingTab && correspondingTab.classList.contains('tab')) {
                     correspondingTab.classList.remove('active');
                 }
            }
        }
    });
}
// --- END MODIFIED closeAllFilterLists function ---

function populateFilterList(header, listElement, currentData) {
    listElement.innerHTML = '';
    let uniqueValues = new Set();
    // console.log(`populateFilterList [${header}]: Processing ${currentData.length} rows.`);

    currentData.forEach((item) => {
        const value = item[header];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            const valueStr = String(value).trim();
            if (header === 'Certification') {
                const parts = valueStr.split(',').map(v => v.trim()).filter(v => v);
                parts.forEach(part => uniqueValues.add(part));
            } else {
                uniqueValues.add(valueStr);
            }
        }
    });
    // console.log(`populateFilterList [${header}]: Found ${uniqueValues.size} unique values.`);

    let sortedValues = [...uniqueValues];

    // Sorting logic (same as before)
    if (numericColumns.includes(header)) {
         try {
            sortedValues.sort((a, b) => {
                const numA = parseFloat(a); const numB = parseFloat(b);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return String(a).localeCompare(String(b));
            });
        } catch (e) { sortedValues.sort((a, b) => String(a).localeCompare(String(b))); }
    } else {
        sortedValues.sort((a, b) => String(a).localeCompare(String(b)));
    }
    // console.log(`populateFilterList [${header}]: Sorted values (${sortedValues.length}).`);

    const selectedValues = filters[header] || [];

    // Render list items
    sortedValues.forEach(value => {
        const listItem = document.createElement('li');
        listItem.textContent = value;
        listItem.dataset.value = value;

        if (selectedValues.includes(String(value))) {
            listItem.classList.add('selected'); // Add checkmark if already selected
        }

        // --- MODIFIED List Item Click Listener ---
        listItem.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent list from closing immediately
            const clickedValue = String(event.target.dataset.value);
            const isSelected = event.target.classList.contains('selected');

            if (isSelected) {
                // If currently selected, remove filter and uncheck
                removeFilter(header, clickedValue);
                event.target.classList.remove('selected');
            } else {
                // If not selected, add filter and check
                addFilter(header, clickedValue);
                event.target.classList.add('selected');
            }
            // DO NOT close list or apply filters here. Wait for explicit close action.
            console.log(`List item clicked [${header}]: Toggled "${clickedValue}". Filters now:`, JSON.parse(JSON.stringify(filters)));
        });
        // --- END MODIFIED List Item Click Listener ---

        listElement.appendChild(listItem);
    });

     if (sortedValues.length === 0) {
        const noItems = document.createElement('li');
        noItems.textContent = 'No available options';
        noItems.style.fontStyle = 'italic'; noItems.style.color = '#888'; noItems.style.cursor = 'default';
        listElement.appendChild(noItems);
    }
    // console.log(`populateFilterList [${header}]: Finished rendering list items.`);
}


function addFilter(header, value) {
    if (!filters[header]) {
        filters[header] = [];
    }
    if (!filters[header].includes(value)) {
        filters[header].push(value);
        // console.log(`Filter added: ${header} = ${value}.`);
    }
}

function removeFilter(header, value) {
    if (filters[header]) {
        filters[header] = filters[header].filter(item => item !== value);
        if (filters[header].length === 0) {
            delete filters[header];
        }
        // console.log(`Filter removed: ${header} = ${value}.`);
    }
}

function renderFilters() {
    const selectedFiltersContainer = document.getElementById('selected-filters-container');
    selectedFiltersContainer.innerHTML = '';

    Object.entries(filters).forEach(([header, values]) => {
        values.forEach(value => {
            const filterTag = document.createElement('div');
            filterTag.classList.add('filter-tag');
            filterTag.textContent = `${header}: ${value}`;

            const removeButton = document.createElement('span');
            removeButton.classList.add('remove-filter');
            removeButton.textContent = '×';
            removeButton.title = `Remove filter ${header}: ${value}`;
            removeButton.addEventListener('click', () => {
                console.log(`Remove tag clicked: ${header} = ${value}`);
                removeFilter(header, value);
                applyFiltersAndRender(); // Apply filters immediately when tag is removed
                // Optionally, update any open list's checkmarks if needed, though closing might be simpler
                closeAllFilterLists();
            });

            filterTag.appendChild(removeButton);
            selectedFiltersContainer.appendChild(filterTag);
        });
    });
}

function filterData() {
    let filteredData = [...originalData];
    // console.log("filterData: Starting with", originalData.length, "rows.");

    Object.entries(filters).forEach(([header, selectedValues]) => {
        if (selectedValues.length === 0) return;

        filteredData = filteredData.filter(item => {
            const itemValue = item[header];
            if (itemValue === undefined || itemValue === null) return false;
            const itemValueStr = String(itemValue).trim();

            if (header === 'Certification') {
                const parts = itemValueStr.split(',').map(v => v.trim()).filter(v => v);
                return selectedValues.some(selVal => parts.includes(selVal));
            } else {
                return selectedValues.includes(itemValueStr);
            }
        });
        // console.log(`filterData: After filtering by ${header}, ${filteredData.length} rows remain.`);
    });
    // console.log("filterData: Finished filtering.", filteredData.length, "rows remaining.");
    return filteredData;
}

function renderDataTable(data) {
    const table = document.getElementById('data-table');
    const tableHead = table.querySelector('thead');
    const tableBody = table.querySelector('tbody');
    const noDataMessage = document.getElementById('no-data-message');

    if (!table || !tableHead || !tableBody || !noDataMessage) {
        console.error("Table elements not found!"); return;
    }

    tableHead.innerHTML = ''; tableBody.innerHTML = '';

    if (data.length === 0) {
        table.style.display = 'none'; noDataMessage.style.display = 'block';
        return;
    }

    table.style.display = ''; noDataMessage.style.display = 'none';

    const headerRow = document.createElement('tr');
    csvHeaders.forEach(header => {
        const th = document.createElement('th'); th.textContent = header; headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    data.forEach(item => {
        const row = document.createElement('tr');
        csvHeaders.forEach(header => {
            const td = document.createElement('td');
            td.textContent = (item[header] !== undefined && item[header] !== null) ? item[header] : '';
            row.appendChild(td);
        });
        tableBody.appendChild(row);
    });
}

// --- applyFiltersAndRender function remains the same ---
// It's now called only when filters should be applied (list close, tag remove)
function applyFiltersAndRender() {
    console.log("--- Applying Filters and Rendering Table ---");
    const currentFilteredData = filterData();
    renderFilters(); // Update the selected filter tags display
    renderDataTable(currentFilteredData); // Update the data table
    console.log("--- Render Complete ---");
}
