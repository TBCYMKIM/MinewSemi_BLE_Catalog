document.addEventListener('DOMContentLoaded', () => {
    fetch('data.csv')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // Read response as text first to handle potential encoding issues if needed
            return response.text();
        })
        .then(csv => {
            console.log("CSV data fetched successfully (length: " + csv.length + "). Starting parse...");
            // Normalize line endings to \n before splitting
            const normalizedCsv = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            const { headers, data } = parseCSV(normalizedCsv); // Parse normalized CSV

            // --- CRITICAL DEBUGGING STEP ---
            console.log(`PARSE COMPLETE: Headers found: ${headers.length}`, headers);
            console.log(`PARSE COMPLETE: Data rows parsed: ${data.length}`);
            if (data.length > 0) {
                console.log("Sample of parsed data (first 5 rows):", JSON.parse(JSON.stringify(data.slice(0, 5))));
                // Specifically check Certification values in the parsed data
                console.log("Certification values in first 20 parsed rows:", data.slice(0, 20).map((row, index) => `Row ${index + 1}: ${row['Certification']}`));
            }
            // --- END CRITICAL DEBUGGING STEP ---

            if (headers.length > 0 && data.length > 0) {
                originalData = data; // Assign parsed data
                csvHeaders = headers;

                // Check if expected number of rows were parsed
                if (originalData.length < 30) { // Adjust '30' if you expect more/less than ~40
                    console.warn(`POTENTIAL PARSING ISSUE: Only ${originalData.length} rows were parsed. Expected more (~40). Check CSV format and console warnings.`);
                }

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
                console.error("CSV parsing resulted in no headers or no data. Cannot proceed.");
                document.getElementById('table-container').innerHTML = '<p>Error: Failed to parse data from data.csv. Check console for parsing errors.</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching or processing data.csv:', error);
            document.getElementById('table-container').innerHTML = `<p>Error loading data: ${error.message}. Please check if data.csv exists and is accessible.</p>`;
        });

    // Document click listener (multi-select version)
    document.addEventListener('click', (event) => {
        const target = event.target;
        if (!target.closest('.tab') && !target.closest('.filter-list')) {
            const wasListOpen = document.querySelector('.filter-list[style*="display: block"]');
            if (wasListOpen) {
                console.log("Clicked outside: Applying filters before closing lists.");
                applyFiltersAndRender();
            }
            closeAllFilterLists();
        }
    });
});

let originalData = [];
let csvHeaders = [];
let numericColumns = [];
let textColumns = [];
let filters = {};

// --- parseCSV function (Enhanced Logging) ---
function parseCSV(csv) {
    // Split lines using the normalized newline character
    const lines = csv.split('\n').filter(line => line.trim() !== '');
    console.log(`parseCSV: Found ${lines.length} non-empty lines.`);
    if (lines.length === 0) return { headers: [], data: [] };

    // Regex remains the same, seems robust for field splitting
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
        try {
            while ((match = regex.exec(line)) !== null) {
                // Ensure match[1] exists before cleaning
                 fields.push(cleanField(match[1] || '')); // Use empty string if match[1] is undefined
            }
            // Handle trailing comma explicitly
            if (line.trim().endsWith(',')) {
                fields.push('');
            }
        } catch (e) {
            console.error(`parseCSV: Error parsing line ${lineNumber} with regex:`, e, "Line content:", line);
            return null; // Indicate error for this line
        }
        return fields;
    };

    // Parse Header Line
    const headers = parseLine(lines[0], 1);
    if (!headers) {
        console.error("parseCSV: Failed to parse header line. Aborting.");
        return { headers: [], data: [] };
    }
    const headerCount = headers.length;
    console.log(`parseCSV: Parsed ${headerCount} headers:`, headers);

    // Parse Data Lines
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const currentLineNumber = i + 1;
        const values = parseLine(lines[i], currentLineNumber);

        if (!values) { // Check if parseLine indicated an error
             console.warn(`parseCSV: Skipping line ${currentLineNumber} due to parsing error.`);
             continue; // Skip this line
        }

        const valueCount = values.length;

        // Strict check: only proceed if value count EXACTLY matches header count
        if (valueCount === headerCount) {
            const row = {};
            let validRow = true;
            for (let j = 0; j < headerCount; j++) {
                const headerName = headers[j];
                if (headerName !== undefined && headerName !== null && headerName !== '') {
                    row[headerName] = values[j];
                } else {
                    // This case should be rare if header parsing is correct, but good to check
                    console.warn(`parseCSV: Invalid header name at index ${j} while processing line ${currentLineNumber}.`);
                    // Decide if you want to skip the row or just the column
                    // validRow = false; break; // Option: Skip entire row if header is bad
                }
            }
             if (validRow) {
                data.push(row);
            }
        } else {
            // Log detailed mismatch information
            console.warn(
                `parseCSV: Skipping line ${currentLineNumber}. ` +
                `Expected ${headerCount} values (based on headers), but found ${valueCount}. ` +
                `\n  Line content: "${lines[i]}"` +
                `\n  Parsed values: [${values.join(' | ')}]` // Show parsed values for comparison
            );
        }
    }
    console.log(`parseCSV: Finished processing ${lines.length - 1} data lines. ${data.length} rows successfully added.`);
    return { headers, data };
}
// --- END OF parseCSV function ---


// --- renderFilterTabs (Multi-select version) ---
function renderFilterTabs(headers) {
    const filterTabsContainer = document.getElementById('filter-tabs-container');
    filterTabsContainer.innerHTML = '';
    // console.log(`renderFilterTabs: Rendering ${headers.length} tabs.`);

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

        tab.addEventListener('click', (event) => {
            event.stopPropagation();
            const listUl = filterList.querySelector('ul');
            if (!listUl) return;
            const isCurrentlyOpen = filterList.style.display === 'block';
            if (isCurrentlyOpen) {
                filterList.style.display = 'none';
                tab.classList.remove('active');
                applyFiltersAndRender(); // Apply filters on close
            } else {
                closeAllFilterLists(filterList); // Close others first
                // *** Re-populate the list EVERY time it opens ***
                // This ensures it reflects the LATEST filtered data
                console.log(`Tab clicked [${header}]: Populating list based on current filters.`);
                populateFilterList(header, listUl, filterData()); // Use filterData() here
                filterList.style.display = 'block';
                tab.classList.add('active');
            }
        });
        tabWrapper.appendChild(tab);
        tabWrapper.appendChild(filterList);
        filterTabsContainer.appendChild(tabWrapper);
    });
    // console.log("renderFilterTabs: Finished rendering tabs.");
}
// --- END renderFilterTabs ---

// --- closeAllFilterLists (Multi-select version) ---
function closeAllFilterLists(excludeList = null) {
    document.querySelectorAll('.filter-list').forEach(list => {
        if (list !== excludeList && list.style.display === 'block') {
            list.style.display = 'none';
            const correspondingTab = list.previousElementSibling;
            if (correspondingTab?.classList.contains('tab')) {
                correspondingTab.classList.remove('active');
            }
        }
    });
}
// --- END closeAllFilterLists ---

// --- populateFilterList (Multi-select version - Check Certification Logic) ---
function populateFilterList(header, listElement, currentData) {
    listElement.innerHTML = '';
    let uniqueValues = new Set();
    console.log(`populateFilterList [${header}]: Processing ${currentData.length} rows from current filter state.`);

    currentData.forEach((item, itemIndex) => {
        const value = item[header];
        if (value !== undefined && value !== null) { // Allow empty strings if they are valid values
             const valueStr = String(value).trim(); // Trim for consistency

            // *** Certification Specific Logic - Double Check ***
            if (header === 'Certification') {
                if (valueStr === '') { // Handle explicitly empty certification fields if needed
                    // uniqueValues.add('(Empty)'); // Option: represent empty as a choice
                } else {
                    const parts = valueStr.split(',').map(v => v.trim()).filter(v => v); // Split, trim, filter empty strings
                    if (parts.length === 0 && valueStr.length > 0) {
                        // This might happen if valueStr was just commas or whitespace
                        console.warn(`populateFilterList [Certification]: Row ${itemIndex+1} had non-empty value "${valueStr}" but produced no parts after split/trim.`);
                    }
                    // console.log(`  [Cert] Row ${itemIndex+1}, Value: "${valueStr}", Parts added:`, parts); // Detailed log
                    parts.forEach(part => uniqueValues.add(part));
                }
            } else {
                // Add non-empty strings or potentially empty strings if desired
                 if (valueStr !== '' || headerAllowsEmpty(header)) { // Add a helper if empty is valid for some headers
                    uniqueValues.add(valueStr);
                 }
            }
        } else {
             // Option: Handle undefined/null values if they should be represented
             // uniqueValues.add('(N/A)');
        }
    });

    console.log(`populateFilterList [${header}]: Found ${uniqueValues.size} unique values:`, Array.from(uniqueValues).sort()); // Log sorted unique values

    let sortedValues = [...uniqueValues];

    // Sorting logic (same as before)
    if (numericColumns.includes(header)) {
         try {
            sortedValues.sort((a, b) => { /* ... numeric sort ... */ });
        } catch (e) { /* ... fallback sort ... */ }
    } else {
        sortedValues.sort((a, b) => String(a).localeCompare(String(b)));
    }

    const selectedValues = filters[header] || [];

    // Render list items (Multi-select version)
    sortedValues.forEach(value => {
        const listItem = document.createElement('li');
        listItem.textContent = value;
        listItem.dataset.value = value;
        if (selectedValues.includes(String(value))) {
            listItem.classList.add('selected');
        }
        listItem.addEventListener('click', (event) => {
            event.stopPropagation();
            const clickedValue = String(event.target.dataset.value);
            const isSelected = event.target.classList.contains('selected');
            if (isSelected) {
                removeFilter(header, clickedValue);
                event.target.classList.remove('selected');
            } else {
                addFilter(header, clickedValue);
                event.target.classList.add('selected');
            }
            // Filters are applied only when list is closed
        });
        listElement.appendChild(listItem);
    });

     if (sortedValues.length === 0) { /* ... no options message ... */ }
}
// --- END populateFilterList ---

// Helper function example (if needed)
function headerAllowsEmpty(header) {
    // Define which headers might legitimately have empty string values
    const allowEmpty = ['SomeOptionalHeader'];
    return allowEmpty.includes(header);
}


// --- addFilter, removeFilter, renderFilters, filterData, renderDataTable, applyFiltersAndRender ---
// --- (These functions remain the same as the previous multi-select version) ---

function addFilter(header, value) {
    if (!filters[header]) filters[header] = [];
    if (!filters[header].includes(value)) filters[header].push(value);
}

function removeFilter(header, value) {
    if (filters[header]) {
        filters[header] = filters[header].filter(item => item !== value);
        if (filters[header].length === 0) delete filters[header];
    }
}

function renderFilters() {
    const container = document.getElementById('selected-filters-container');
    container.innerHTML = '';
    Object.entries(filters).forEach(([header, values]) => {
        values.forEach(value => {
            const tag = document.createElement('div');
            tag.className = 'filter-tag';
            tag.textContent = `${header}: ${value}`;
            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove-filter';
            removeBtn.textContent = '×';
            removeBtn.title = `Remove filter ${header}: ${value}`;
            removeBtn.onclick = () => { // Use onclick for simplicity here
                removeFilter(header, value);
                applyFiltersAndRender();
                closeAllFilterLists();
            };
            tag.appendChild(removeBtn);
            container.appendChild(tag);
        });
    });
}

function filterData() {
    let filteredData = [...originalData];
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
    });
    return filteredData;
}

function renderDataTable(data) {
    const table = document.getElementById('data-table'), thead = table.tHead, tbody = table.tBodies[0], msg = document.getElementById('no-data-message');
    if (!table || !thead || !tbody || !msg) return;
    thead.innerHTML = ''; tbody.innerHTML = '';
    if (data.length === 0) { table.style.display = 'none'; msg.style.display = 'block'; return; }
    table.style.display = ''; msg.style.display = 'none';
    const hr = thead.insertRow();
    csvHeaders.forEach(h => { const th = document.createElement('th'); th.textContent = h; hr.appendChild(th); });
    data.forEach(item => {
        const r = tbody.insertRow();
        csvHeaders.forEach(h => { r.insertCell().textContent = (item[h] ?? ''); }); // Use nullish coalescing
    });
}

function applyFiltersAndRender() {
    console.log("--- Applying Filters and Rendering Table ---");
    const currentFilteredData = filterData();
    renderFilters();
    renderDataTable(currentFilteredData);
    console.log("--- Render Complete ---");
}