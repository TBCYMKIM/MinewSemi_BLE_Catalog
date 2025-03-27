document.addEventListener('DOMContentLoaded', () => {
    fetch('data.csv')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.text();
        })
        .then(csv => {
            console.log("CSV data fetched successfully.");
            const normalizedCsv = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            const { headers, data } = parseCSV(normalizedCsv);

            console.log(`PARSE COMPLETE: Headers found: ${headers.length}`, headers);
            console.log(`PARSE COMPLETE: Data rows parsed: ${data.length}`);
            if (data.length > 0) {
                console.log("Sample of parsed data (first 2 rows):", JSON.parse(JSON.stringify(data.slice(0, 2))));
            }

            if (headers.length > 0 && data.length > 0) {
                originalData = data;
                csvHeaders = headers;

                if (originalData.length < 30) { // Basic sanity check
                    console.warn(`POTENTIAL PARSING ISSUE: Only ${originalData.length} rows were parsed. Expected more. Check CSV format and console warnings.`);
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
                console.error("CSV parsing resulted in no headers or no data.");
                document.getElementById('table-container').innerHTML = '<p>Error: Failed to parse data from data.csv.</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching or processing data.csv:', error);
            document.getElementById('table-container').innerHTML = `<p>Error loading data: ${error.message}.</p>`;
        });

    // Document click listener (for closing dropdowns)
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

// --- parseCSV function (Handles quoted fields, trailing comma discrepancy) ---
function parseCSV(csv) {
    const lines = csv.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return { headers: [], data: [] };
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
        const fields = []; let match; regex.lastIndex = 0;
        try {
            while ((match = regex.exec(line)) !== null) fields.push(cleanField(match[1] || ''));
        } catch (e) { console.error(`parseCSV Error line ${lineNumber}:`, e, line); return null; }
        return fields;
    };
    const headers = parseLine(lines[0], 1);
    if (!headers) return { headers: [], data: [] };
    const headerCount = headers.length;
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const currentLineNumber = i + 1;
        let values = parseLine(lines[i], currentLineNumber);
        if (!values) continue;
        let valueCount = values.length;
        if (valueCount === headerCount + 1 && values[valueCount - 1] === '') {
            values.pop(); valueCount--;
        }
        if (valueCount === headerCount) {
            const row = {};
            for (let j = 0; j < headerCount; j++) {
                if (headers[j] !== undefined && headers[j] !== null && headers[j].trim() !== '') {
                    row[headers[j]] = values[j];
                }
            }
            data.push(row);
        } else if (valueCount > 0) {
            console.warn(`parseCSV: Skipping line ${currentLineNumber}. Values (${valueCount}) != Headers (${headerCount}). Line: "${lines[i]}"`);
        }
    }
    return { headers, data };
}
// --- END parseCSV ---


// --- renderFilterTabs (Multi-select version) ---
function renderFilterTabs(headers) {
    const container = document.getElementById('filter-tabs-container');
    container.innerHTML = '';
    headers.forEach((header) => {
        if (!header || typeof header !== 'string' || header.trim() === '') return;
        const wrapper = document.createElement('div'); wrapper.className = 'tab-wrapper';
        const tab = document.createElement('button'); tab.className = 'tab';
        tab.textContent = header; tab.dataset.header = header;
        const listDiv = document.createElement('div'); listDiv.className = 'filter-list';
        listDiv.style.display = 'none'; listDiv.innerHTML = '<ul></ul>';
        tab.addEventListener('click', (e) => {
            e.stopPropagation();
            const listUl = listDiv.querySelector('ul'); if (!listUl) return;
            const isOpen = listDiv.style.display === 'block';
            if (isOpen) {
                listDiv.style.display = 'none'; tab.classList.remove('active');
                applyFiltersAndRender(); // Apply on close
            } else {
                closeAllFilterLists(listDiv); // Close others
                populateFilterList(header, listUl, filterData()); // Populate based on current filters
                listDiv.style.display = 'block'; tab.classList.add('active');
            }
        });
        wrapper.appendChild(tab); wrapper.appendChild(listDiv); container.appendChild(wrapper);
    });
}
// --- END renderFilterTabs ---

// --- closeAllFilterLists (Multi-select version) ---
function closeAllFilterLists(excludeList = null) {
    document.querySelectorAll('.filter-list').forEach(list => {
        if (list !== excludeList && list.style.display === 'block') {
            list.style.display = 'none';
            const tab = list.previousElementSibling;
            if (tab?.classList.contains('tab')) tab.classList.remove('active');
        }
    });
}
// --- END closeAllFilterLists ---

// --- populateFilterList (Multi-select version) ---
function populateFilterList(header, listElement, currentData) {
    listElement.innerHTML = ''; let uniqueValues = new Set();
    currentData.forEach((item) => {
        const value = item[header];
        if (value !== undefined && value !== null) {
            const valueStr = String(value).trim();
            if (header === 'Certification') {
                if (valueStr !== '') valueStr.split(',').map(v => v.trim()).filter(v => v).forEach(part => uniqueValues.add(part));
            } else {
                if (valueStr !== '' || headerAllowsEmpty(header)) uniqueValues.add(valueStr);
            }
        }
    });
    let sortedValues = [...uniqueValues];
    if (numericColumns.includes(header)) {
        try { sortedValues.sort((a, b) => { const nA = parseFloat(a), nB = parseFloat(b); return !isNaN(nA) && !isNaN(nB) ? nA - nB : String(a).localeCompare(String(b)); }); }
        catch (e) { sortedValues.sort((a, b) => String(a).localeCompare(String(b))); }
    } else { sortedValues.sort((a, b) => String(a).localeCompare(String(b))); }
    const selectedValues = filters[header] || [];
    sortedValues.forEach(value => {
        const li = document.createElement('li'); li.textContent = value; li.dataset.value = value;
        if (selectedValues.includes(String(value))) li.classList.add('selected');
        li.addEventListener('click', (e) => {
            e.stopPropagation();
            const clickedVal = String(e.target.dataset.value);
            const isSel = e.target.classList.contains('selected');
            if (isSel) { removeFilter(header, clickedVal); e.target.classList.remove('selected'); }
            else { addFilter(header, clickedVal); e.target.classList.add('selected'); }
        });
        listElement.appendChild(li);
    });
    if (sortedValues.length === 0) { const li = document.createElement('li'); li.textContent = 'No available options'; li.style.cssText = 'font-style:italic; color:#888; cursor:default;'; listElement.appendChild(li); }
}
// --- END populateFilterList ---

// Helper function example (if needed)
function headerAllowsEmpty(header) { return false; } // Assume empty strings are not valid options unless specified

// --- addFilter, removeFilter (Multi-select version) ---
function addFilter(header, value) { if (!filters[header]) filters[header] = []; if (!filters[header].includes(value)) filters[header].push(value); }
function removeFilter(header, value) { if (filters[header]) { filters[header] = filters[header].filter(i => i !== value); if (filters[header].length === 0) delete filters[header]; } }
// --- END addFilter, removeFilter ---

// --- renderFilters (Multi-select version) ---
function renderFilters() {
    const container = document.getElementById('selected-filters-container'); container.innerHTML = '';
    Object.entries(filters).forEach(([header, values]) => {
        values.forEach(value => {
            const tag = document.createElement('div'); tag.className = 'filter-tag'; tag.textContent = `${header}: ${value}`;
            const removeBtn = document.createElement('span'); removeBtn.className = 'remove-filter'; removeBtn.textContent = '×'; removeBtn.title = `Remove filter ${header}: ${value}`;
            removeBtn.onclick = () => { removeFilter(header, value); applyFiltersAndRender(); closeAllFilterLists(); };
            tag.appendChild(removeBtn); container.appendChild(tag);
        });
    });
}
// --- END renderFilters ---

// --- filterData (Multi-select version) ---
function filterData() {
    let filteredData = [...originalData];
    Object.entries(filters).forEach(([header, selectedValues]) => {
        if (selectedValues.length === 0) return;
        filteredData = filteredData.filter(item => {
            const itemValue = item[header]; if (itemValue === undefined || itemValue === null) return false;
            const itemValueStr = String(itemValue).trim();
            if (header === 'Certification') { const parts = itemValueStr.split(',').map(v => v.trim()).filter(v => v); return selectedValues.some(selVal => parts.includes(selVal)); }
            else { return selectedValues.includes(itemValueStr); }
        });
    });
    return filteredData;
}
// --- END filterData ---

// --- MODIFIED renderDataTable function (Adds 'Details' column/button) ---
function renderDataTable(data) {
    const table = document.getElementById('data-table'), thead = table.tHead, tbody = table.tBodies[0], msg = document.getElementById('no-data-message');
    if (!table || !thead || !tbody || !msg) return;
    thead.innerHTML = ''; tbody.innerHTML = '';
    if (data.length === 0) { table.style.display = 'none'; msg.style.display = 'block'; return; }
    table.style.display = ''; msg.style.display = 'none';
    const hr = thead.insertRow();
    // Add "Details" header
    const thDetails = document.createElement('th'); thDetails.textContent = 'Details'; hr.appendChild(thDetails);
    // Add original headers
    csvHeaders.forEach(h => { const th = document.createElement('th'); th.textContent = h; hr.appendChild(th); });
    // Add data rows
    data.forEach(item => {
        const r = tbody.insertRow();
        // Add details button cell
        const cellDetails = r.insertCell();
        const btn = document.createElement('button'); btn.textContent = 'View'; btn.className = 'details-button';
        const modelNo = item['Model No.']; // Ensure 'Model No.' matches CSV header exactly
        if (modelNo) { btn.dataset.modelNo = modelNo; btn.addEventListener('click', handleDetailsClick); }
        else { btn.disabled = true; btn.title = "Model No. unavailable"; }
        cellDetails.appendChild(btn);
        // Add original data cells
        csvHeaders.forEach(h => { r.insertCell().textContent = (item[h] ?? ''); });
    });
}
// --- END MODIFIED renderDataTable function ---

// --- NEW: Event handler for details button click ---
function handleDetailsClick(event) {
    const button = event.target;
    const modelNo = button.dataset.modelNo;
    if (!modelNo) return;
    const rowData = originalData.find(item => item['Model No.'] === modelNo);
    if (rowData) displayProductDetails(rowData);
    else console.error(`Data for Model No. "${modelNo}" not found.`);
}
// --- END NEW Event handler ---

// --- MODIFIED displayProductDetails function (Adds close button in table, updates header, handles image name) ---
function displayProductDetails(rowData) {
    const detailsContainer = document.getElementById('details-container');
    const headerContainer = document.getElementById('selected-detail-header');
    if (!detailsContainer || !headerContainer) return;
    const modelNo = rowData['Model No.'];
    const existingDetailBox = detailsContainer.querySelector(`.detail-box[data-model-no="${modelNo}"]`);
    if (existingDetailBox) {
        existingDetailBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        existingDetailBox.style.transition = 'outline 0.1s ease-in-out';
        existingDetailBox.style.outline = '2px solid var(--accent-color)';
        setTimeout(() => { existingDetailBox.style.outline = 'none'; }, 500);
        return;
    }
    const detailBox = document.createElement('div');
    detailBox.className = 'detail-box'; detailBox.dataset.modelNo = modelNo;
    // Image Handling
    const img = document.createElement('img'); img.className = 'detail-image';
    const baseModelNo = modelNo.replace(/\s*\([ABab]\)\s*$/, '').trim(); // Remove (A)/(B)
    const imageName = baseModelNo.replace(/[\s()/]/g, '_'); // Sanitize
    const imagePathPng = `images/${imageName}.png`; const imagePathJpg = `images/${imageName}.jpg`;
    img.alt = `Image of ${modelNo}`; img.style.display = 'none';
    img.onerror = () => { img.onerror = () => { console.warn(`Image not found for ${baseModelNo}`); }; img.src = imagePathJpg; };
    img.onload = () => { img.style.display = 'block'; };
    img.src = imagePathPng;
    detailBox.appendChild(img);
    // Details Table
    const detailTable = document.createElement('div'); detailTable.className = 'detail-table';
    // Add Close Button Row
    const closeRow = document.createElement('div'); closeRow.className = 'close-button-cell';
    const closeKey = document.createElement('strong'); closeKey.textContent = 'Action:';
    const closeBtnCell = document.createElement('span');
    const closeBtn = document.createElement('button'); closeBtn.textContent = 'Close';
    closeBtn.onclick = () => { detailBox.remove(); updateSelectedDetailHeader(); };
    closeBtnCell.appendChild(closeBtn); closeRow.appendChild(closeKey); closeRow.appendChild(closeBtnCell); detailTable.appendChild(closeRow);
    // Add Data Rows
    csvHeaders.forEach(key => {
        if (rowData.hasOwnProperty(key)) {
            const val = rowData[key] ?? 'N/A';
            const rowDiv = document.createElement('div');
            const keyEl = document.createElement('strong'); keyEl.textContent = key + ':';
            const valEl = document.createElement('span'); valEl.textContent = val;
            rowDiv.appendChild(keyEl); rowDiv.appendChild(valEl); detailTable.appendChild(rowDiv);
        }
    });
    detailBox.appendChild(detailTable);
    detailsContainer.appendChild(detailBox);
    updateSelectedDetailHeader(); // Update header after adding
    detailBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
// --- END MODIFIED displayProductDetails function ---

// --- NEW: Function to update the selected detail header ---
function updateSelectedDetailHeader() {
    const detailsContainer = document.getElementById('details-container');
    const headerContainer = document.getElementById('selected-detail-header');
    if (!detailsContainer || !headerContainer) return;
    const firstDetailBox = detailsContainer.querySelector('.detail-box'); // Get the first one displayed
    if (firstDetailBox) {
        const modelNo = firstDetailBox.dataset.modelNo;
        const rowData = originalData.find(item => item['Model No.'] === modelNo);
        const socSet = rowData ? (rowData['SoCset'] || 'N/A') : 'N/A';
        headerContainer.textContent = `Selected: ${socSet} - ${modelNo}`;
        headerContainer.style.display = 'block';
    } else {
        headerContainer.textContent = '';
        headerContainer.style.display = 'none';
    }
}
// --- END NEW Function ---

// --- applyFiltersAndRender function (Multi-select version) ---
function applyFiltersAndRender() {
    console.log("--- Applying Filters and Rendering Table ---");
    const currentFilteredData = filterData();
    renderFilters();
    renderDataTable(currentFilteredData); // Re-render table with buttons
    console.log("--- Render Complete ---");
}