const GOOGLE_FORM_LINK = 'YOUR_GOOGLE_FORM_LINK_HERE';

document.addEventListener('DOMContentLoaded', () => {
    fetch('data.csv')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.text();
        })
        .then(csv => {
            const normalizedCsv = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            const { headers, data } = parseCSV(normalizedCsv);

            if (headers.length > 0 && data.length > 0) {
                originalData = data;
                csvHeaders = headers;

                numericColumns = [
                    'Max Range (M)', 'Max Length (mm)', 'Mid Length (mm)', 'Min Length (mm)',
                    'Flash (KB)', 'RAM (KB)', 'Reception Sensitivity (dBm)',
                    'Transmission Power (min, dBM)', 'Transmission Power (max, dBM)',
                    'Current (TX, mA)', 'Current (RX, mA)', 'GPIO'
                ];
                textColumns = headers.filter(h => !numericColumns.includes(h));

                renderFilterTabs(headers);
                applyFiltersAndRender();
            } else {
                console.error("CSV parsing resulted in no headers or no data.");
                document.getElementById('table-container').innerHTML = '<p>Error: Failed to parse data from data.csv.</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching or processing data.csv:', error);
            document.getElementById('table-container').innerHTML = `<p>Error loading data: ${error.message}.</p>`;
        });

    document.addEventListener('click', (event) => {
        const target = event.target;
        if (!target.closest('.tab') && !target.closest('.filter-list')) {
            const wasListOpen = document.querySelector('.filter-list[style*="display: block"]');
            if (wasListOpen) {
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
                applyFiltersAndRender();
            } else {
                closeAllFilterLists(listDiv);
                populateFilterList(header, listUl, filterData());
                listDiv.style.display = 'block'; tab.classList.add('active');
            }
        });
        wrapper.appendChild(tab); wrapper.appendChild(listDiv); container.appendChild(wrapper);
    });
}

function closeAllFilterLists(excludeList = null) {
    document.querySelectorAll('.filter-list').forEach(list => {
        if (list !== excludeList && list.style.display === 'block') {
            list.style.display = 'none';
            const tab = list.previousElementSibling;
            if (tab?.classList.contains('tab')) tab.classList.remove('active');
        }
    });
}

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

function headerAllowsEmpty(header) { return false; }

function addFilter(header, value) { if (!filters[header]) filters[header] = []; if (!filters[header].includes(value)) filters[header].push(value); }
function removeFilter(header, value) { if (filters[header]) { filters[header] = filters[header].filter(i => i !== value); if (filters[header].length === 0) delete filters[header]; } }

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

function renderDataTable(data) {
    const table = document.getElementById('data-table'), thead = table.tHead, tbody = table.tBodies[0];
    const initialMsg = document.getElementById('initial-message');
    const noDataMsg = document.getElementById('no-data-message');

    if (!table || !thead || !tbody || !initialMsg || !noDataMsg) return;

    thead.innerHTML = ''; tbody.innerHTML = '';

    const hasActiveFilters = Object.keys(filters).length > 0;

    if (!hasActiveFilters) {
        table.style.display = 'none';
        noDataMsg.style.display = 'none';
        initialMsg.style.display = 'block';
        return;
    }

    initialMsg.style.display = 'none';

    if (data.length === 0) {
        table.style.display = 'none';
        noDataMsg.style.display = 'block';
        return;
    }

    table.style.display = '';
    noDataMsg.style.display = 'none';

    const hr = thead.insertRow();
    const thDetails = document.createElement('th'); thDetails.textContent = 'Details'; hr.appendChild(thDetails);
    csvHeaders.forEach(h => { const th = document.createElement('th'); th.textContent = h; hr.appendChild(th); });

    data.forEach(item => {
        const r = tbody.insertRow();
        const cellDetails = r.insertCell();
        const btn = document.createElement('button'); btn.textContent = 'View'; btn.className = 'details-button';
        const modelNo = item['Model No.'];
        if (modelNo) { btn.dataset.modelNo = modelNo; btn.addEventListener('click', handleDetailsClick); }
        else { btn.disabled = true; btn.title = "Model No. unavailable"; }
        cellDetails.appendChild(btn);
        csvHeaders.forEach(h => { r.insertCell().textContent = (item[h] ?? ''); });
    });
}

function handleDetailsClick(event) {
    const button = event.target;
    const modelNo = button.dataset.modelNo;
    if (!modelNo) return;
    const rowData = originalData.find(item => item['Model No.'] === modelNo);
    if (rowData) displayProductDetails(rowData);
    else console.error(`Data for Model No. "${modelNo}" not found.`);
}

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

    const img = document.createElement('img'); img.className = 'detail-image';
    const baseModelNo = modelNo.replace(/\s*\([ABab]\)\s*$/, '').trim();
    const imageName = baseModelNo.replace(/[\s()/]/g, '_');
    const imagePathPng = `images/${imageName}.png`; const imagePathJpg = `images/${imageName}.jpg`;
    img.alt = `Image of ${modelNo}`; img.style.display = 'none';
    img.onerror = () => { img.onerror = () => { console.warn(`Image not found for ${baseModelNo}`); }; img.src = imagePathJpg; };
    img.onload = () => { img.style.display = 'block'; };
    img.src = imagePathPng;
    detailBox.appendChild(img);

    const detailTable = document.createElement('div'); detailTable.className = 'detail-table';

    const closeRow = document.createElement('div'); closeRow.className = 'close-button-cell';
    const closeKey = document.createElement('strong'); closeKey.textContent = 'Action:';
    const closeBtnCell = document.createElement('span');
    const closeBtn = document.createElement('button'); closeBtn.textContent = 'Close';
    closeBtn.onclick = () => { detailBox.remove(); updateSelectedDetailHeader(); };
    closeBtnCell.appendChild(closeBtn); closeRow.appendChild(closeKey); closeRow.appendChild(closeBtnCell); detailTable.appendChild(closeRow);

    csvHeaders.forEach(key => {
        if (rowData.hasOwnProperty(key)) {
            const val = rowData[key] ?? 'N/A';
            const rowDiv = document.createElement('div');
            const keyEl = document.createElement('strong'); keyEl.textContent = key + ':';
            const valEl = document.createElement('span'); valEl.textContent = val;
            rowDiv.appendChild(keyEl); rowDiv.appendChild(valEl); detailTable.appendChild(rowDiv);
        }
    });

    const inquiryRow = document.createElement('div'); inquiryRow.className = 'inquiry-button-cell';
    const inquiryKey = document.createElement('strong'); inquiryKey.textContent = '문의하기:';
    const inquiryBtnCell = document.createElement('span');
    const inquiryBtn = document.createElement('button'); inquiryBtn.textContent = '제품 문의하기';
    inquiryBtn.onclick = () => {
        if (GOOGLE_FORM_LINK && GOOGLE_FORM_LINK !== 'YOUR_GOOGLE_FORM_LINK_HERE') {
            window.open(GOOGLE_FORM_LINK, '_blank');
        } else {
            alert('문의 링크가 설정되지 않았습니다.');
        }
    };
    inquiryBtnCell.appendChild(inquiryBtn); inquiryRow.appendChild(inquiryKey); inquiryRow.appendChild(inquiryBtnCell); detailTable.appendChild(inquiryRow);

    detailBox.appendChild(detailTable);
    detailsContainer.appendChild(detailBox);
    updateSelectedDetailHeader();
}

function updateSelectedDetailHeader() {
    const detailsContainer = document.getElementById('details-container');
    const headerContainer = document.getElementById('selected-detail-header');
    if (!detailsContainer || !headerContainer) return;

    headerContainer.innerHTML = '';
    const detailBoxes = detailsContainer.querySelectorAll('.detail-box');

    if (detailBoxes.length > 0) {
        detailBoxes.forEach(box => {
            const modelNo = box.dataset.modelNo;
            const rowData = originalData.find(item => item['Model No.'] === modelNo);
            const socSet = rowData ? (rowData['SoCset'] || 'N/A') : 'N/A';

            const itemSpan = document.createElement('span');
            itemSpan.classList.add('selected-header-item');

            const textNode = document.createTextNode(`${socSet} - ${modelNo}`);
            itemSpan.appendChild(textNode);

            const removeBtn = document.createElement('span');
            removeBtn.classList.add('remove-header-item');
            removeBtn.innerHTML = '×';
            removeBtn.title = `Remove ${modelNo} details`;
            removeBtn.dataset.modelNo = modelNo;
            removeBtn.onclick = (event) => {
                const modelToRemove = event.target.dataset.modelNo;
                const boxToRemove = detailsContainer.querySelector(`.detail-box[data-model-no="${modelToRemove}"]`);
                if (boxToRemove) {
                    boxToRemove.remove();
                    updateSelectedDetailHeader();
                }
            };
            itemSpan.appendChild(removeBtn);

            headerContainer.appendChild(itemSpan);
        });
        headerContainer.style.display = 'flex';
    } else {
        headerContainer.style.display = 'none';
    }
}

function applyFiltersAndRender() {
    const currentFilteredData = filterData();
    renderFilters();
    renderDataTable(currentFilteredData);
}