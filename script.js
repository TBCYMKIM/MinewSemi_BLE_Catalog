document.addEventListener('DOMContentLoaded', () => {
    fetch('data.csv')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(csv => {
            const { headers, data } = parseCSV(csv); // Use the NEW parseCSV
            if (headers.length > 0 && data.length > 0) {
                originalData = data;
                csvHeaders = headers;
                // Define column types (These names MUST exactly match the headers after parsing)
                numericColumns = [
                    'Max Range (M)', 'Max Length (mm)', 'Mid Length (mm)', 'Min Length (mm)',
                    'Flash (KB)', 'RAM (KB)', 'Reception Sensitivity (dBm)',
                    'Transmission Power (min, dBM)', 'Transmission Power (max, dBM)', // Now correctly parsed
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

// --- NEW parseCSV function using Regular Expression ---
function parseCSV(csv) {
    const lines = csv.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return { headers: [], data: [] };

    // Regular expression to split CSV line respecting quotes
    // Matches:
    // 1. Fields without quotes OR
    // 2. Fields with quotes (handling escaped quotes "" inside)
    const regex = /("([^"]*(?:""[^"]*)*)"|[^",]+)(?=\s*,|\s*$)/g;
    // Explanation:
    // ("([^"]*(?:""[^"]*)*)") : Group 1 - Matches a quoted field
    //   " : Matches the opening quote
    //   ([^"]*(?:""[^"]*)*) : Group 2 - Captures the content inside quotes
    //     [^"]* : Matches any character except a quote (0 or more times)
    //     (?:""[^"]*)* : Matches escaped quotes ("") followed by non-quotes (0 or more times)
    //   " : Matches the closing quote
    // | : OR
    // ([^",]+) : Group 3 - Matches a non-quoted field (any char except quote or comma, 1 or more times)
    // (?=\s*,|\s*$) : Positive lookahead - Ensures the match is followed by a comma or end of line (consuming whitespace)

    // Helper function to clean the matched field (remove quotes, handle escaped quotes)
    const cleanField = (field) => {
        if (typeof field !== 'string') return field;
        let cleaned = field.trim();
        // If the field was quoted (starts and ends with "), remove them and unescape internal quotes
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            cleaned = cleaned.substring(1, cleaned.length - 1).replace(/""/g, '"');
        }
        return cleaned;
    };

    const parseLine = (line) => {
        const fields = [];
        let match;
        // Reset lastIndex before each line processing
        regex.lastIndex = 0;
        while ((match = regex.exec(line)) !== null) {
            // match[1] contains the full matched field (quoted or unquoted)
            fields.push(cleanField(match[1]));
        }
         // Handle case where line might end with a comma (empty last field)
        if (line.trim().endsWith(',')) {
            fields.push('');
        }
        return fields;
    };

    const headers = parseLine(lines[0]);
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i]);

        if (values.length === headers.length) {
            const row = {};
            for (let j = 0; j < headers.length; j++) {
                if (headers[j]) {
                    row[headers[j]] = values[j];
                } else {
                     console.warn(`Undefined header at index ${j} for line ${i + 1}`);
                }
            }
            data.push(row);
        } else if (values.length > 0) { // Only warn if the line wasn't just whitespace
             console.warn(`Skipping line ${i + 1}: Number of values (${values.length}) does not match number of headers (${headers.length}).\nHeaders: [${headers.join(', ')}]\nValues: [${values.join(', ')}]\nOriginal Line: ${lines[i]}`);
        }
    }
    // console.log("Parsed Headers:", headers); // Debugging
    // console.log("Parsed Data Sample:", data.slice(0, 2)); // Debugging
    return { headers, data };
}
// --- END OF NEW parseCSV function ---


// --- The rest of the functions (renderFilterTabs, closeAllFilterLists, etc.) remain the same as the previous version ---

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
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            const valueStr = String(value).trim();
            if (header === 'Certification') {
                valueStr.split(',').map(v => v.trim()).filter(v => v).forEach(part => uniqueValues.add(part));
            } else {
                uniqueValues.add(valueStr);
            }
        }
    });

    let sortedValues = [...uniqueValues];

    if (numericColumns.includes(header)) {
         try {
            sortedValues.sort((a, b) => {
                const numA = parseFloat(a);
                const numB = parseFloat(b);
                if (!isNaN(numA) && !isNaN(numB)) {
                    return numA - numB;
                }
                return String(a).localeCompare(String(b));
            });
        } catch (e) {
            console.warn(`Could not sort column "${header}" numerically, falling back to string sort. Error: ${e}`);
            sortedValues.sort((a, b) => String(a).localeCompare(String(b)));
        }
    } else {
        sortedValues.sort((a, b) => String(a).localeCompare(String(b)));
    }

    const selectedValues = filters[header] || [];

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
    if (!filters[header].includes(value)) {
        filters[header].push(value);
    }
}

function removeFilter(header, value) {
    if (filters[header]) {
        filters[header] = filters[header].filter(item => item !== value);
        if (filters[header].length === 0) {
            delete filters[header];
        }
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
                removeFilter(header, value);
                applyFiltersAndRender();
                closeAllFilterLists();
            });

            filterTag.appendChild(removeButton);
            selectedFiltersContainer.appendChild(filterTag);
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
    const table = document.getElementById('data-table');
    const tableHead = table.querySelector('thead');
    const tableBody = table.querySelector('tbody');
    const noDataMessage = document.getElementById('no-data-message');

    if (!table || !tableHead || !tableBody || !noDataMessage) {
        console.error("Table elements not found in the DOM!");
        return;
    }

    tableHead.innerHTML = '';
    tableBody.innerHTML = '';

    if (data.length === 0) {
        table.style.display = 'none';
        noDataMessage.style.display = 'block';
        return;
    }

    table.style.display = '';
    noDataMessage.style.display = 'none';

    const headerRow = document.createElement('tr');
    csvHeaders.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
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

function applyFiltersAndRender() {
    const currentFilteredData = filterData();
    renderFilters();
    renderDataTable(currentFilteredData);
}
