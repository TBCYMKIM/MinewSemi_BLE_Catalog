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
let viewedProductIds = new Set();

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

        if (filters[header] && filters[header].length > 0) {
            tab.classList.add('has-filter');
        }

        tab.addEventListener('click', (e) => {
            e.stopPropagation();
            const listUl = listDiv.querySelector('ul'); if (!listUl) return;
            const isOpen = listDiv.style.display === 'block';
            if (isOpen) {
                listDiv.style.display = 'none'; tab.classList.remove('active');
                applyFiltersAndRender();
            } else {
                closeAllFilterLists(listDiv);
                populateFilterList(header, listUl);
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

function getFilteredDataExcluding(excludeHeader) {
    let tempFilters = { ...filters };
    if (excludeHeader) {
        delete tempFilters[excludeHeader];
    }
    let filteredData = [...originalData];
    Object.entries(tempFilters).forEach(([header, selectedValues]) => {
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


function populateFilterList(header, listElement) {
    listElement.innerHTML = ''; let uniqueValues = new Set();

    const dataForList = getFilteredDataExcluding(header);

    dataForList.forEach((item) => {
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

    const currentSelectionsForThisHeader = filters[header] || [];

    sortedValues.forEach(value => {
        const li = document.createElement('li'); li.textContent = value; li.dataset.value = value;
        if (currentSelectionsForThisHeader.includes(String(value))) {
             li.classList.add('selected');
        }
        li.addEventListener('click', (e) => {
            e.stopPropagation();
            const clickedVal = String(e.target.dataset.value);
            const isSel = e.target.classList.contains('selected');
            if (isSel) { removeFilter(header, clickedVal); e.target.classList.remove('selected'); }
            else { addFilter(header, clickedVal); e.target.classList.add('selected'); }

            const tabButton = listElement.closest('.tab-wrapper').querySelector('.tab');
            if (filters[header] && filters[header].length > 0) {
                tabButton.classList.add('has-filter');
            } else {
                tabButton.classList.remove('has-filter');
            }
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
            removeBtn.onclick = () => {
                removeFilter(header, value);
                const tabButton = document.querySelector(`.tab[data-header="${header}"]`);
                if (tabButton && (!filters[header] || filters[header].length === 0)) {
                    tabButton.classList.remove('has-filter');
                }
                applyFiltersAndRender();
                closeAllFilterLists();
            };
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

    const hasActiveFilters = Object.keys(filters).some(key => filters[key].length > 0);

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
    const thDetails = document.createElement('th'); thDetails.textContent = 'Compare'; hr.appendChild(thDetails);
    csvHeaders.forEach(h => { const th = document.createElement('th'); th.textContent = h; hr.appendChild(th); });

    data.forEach(item => {
        const r = tbody.insertRow();
        const cellDetails = r.insertCell();
        const btn = document.createElement('button'); btn.className = 'details-button';

        const modelNo = item['Model No.'];
        const socSet = item['SoCset'];
        const uniqueId = `${modelNo}__${socSet}`;

        if (modelNo && socSet) {
            btn.dataset.uniqueId = uniqueId;
            btn.addEventListener('click', handleDetailsClick);
            if (viewedProductIds.has(uniqueId)) {
                 btn.textContent = 'View';
                 btn.disabled = true;
                 btn.style.backgroundColor = '#ccc';
            } else {
                 btn.textContent = 'Add';
                 btn.disabled = false;
                 btn.style.backgroundColor = '';
            }
        } else {
            btn.disabled = true; btn.title = "Unique ID unavailable";
        }
        cellDetails.appendChild(btn);
        csvHeaders.forEach(h => { r.insertCell().textContent = (item[h] ?? ''); });
    });
}

function handleDetailsClick(event) {
    const button = event.target;
    const uniqueId = button.dataset.uniqueId;
    if (!uniqueId) return;

    if (!viewedProductIds.has(uniqueId)) {
        viewedProductIds.add(uniqueId);
        renderComparisonView();
        button.textContent = 'View';
        button.disabled = true;
        button.style.backgroundColor = '#ccc';
    } else {
         const comparisonProductCol = document.querySelector(`.comparison-product[data-unique-id="${uniqueId}"]`);
         if (comparisonProductCol) {
             comparisonProductCol.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
             comparisonProductCol.style.transition = 'outline 0.1s ease-in-out';
             comparisonProductCol.style.outline = '2px solid var(--accent-color)';
             setTimeout(() => { comparisonProductCol.style.outline = 'none'; }, 500);
         }
    }
}

function getComparisonData() {
    const products = [];
    viewedProductIds.forEach(id => {
        const product = originalData.find(item => `${item['Model No.']}__${item['SoCset']}` === id);
        if (product) {
            products.push(product);
        }
    });

    const vendorCounts = products.reduce((acc, product) => {
        const vendor = product['Chipset Vendor'] || 'Unknown';
        acc[vendor] = (acc[vendor] || 0) + 1;
        return acc;
    }, {});

    products.sort((a, b) => {
        const countA = vendorCounts[a['Chipset Vendor'] || 'Unknown'] || 0;
        const countB = vendorCounts[b['Chipset Vendor'] || 'Unknown'] || 0;
        if (countB !== countA) {
            return countB - countA;
        }
        const modelCompare = String(a['Model No.']).localeCompare(String(b['Model No.']));
        if (modelCompare !== 0) {
            return modelCompare;
        }
        return String(a['SoCset']).localeCompare(String(b['SoCset']));
    });

    return products;
}

function renderComparisonView() {
    const comparisonSection = document.getElementById('comparison-section');
    const container = document.getElementById('comparison-container');
    if (!container || !comparisonSection) return;

    container.innerHTML = '';
    const productsToCompare = getComparisonData();

    if (productsToCompare.length === 0) {
        comparisonSection.style.display = 'none';
        return;
    }

    comparisonSection.style.display = 'block';

    const stickySpecs = ['Action', 'Image'];
    const scrollableSpecs = [...csvHeaders];
    const inquirySpec = ['Inquiry'];

    const specsDiv = document.createElement('div');
    specsDiv.className = 'comparison-specs';

    const stickySpecHeaderDiv = document.createElement('div');
    stickySpecHeaderDiv.className = 'spec-sticky-header';
    stickySpecs.forEach(spec => {
        const specNameDiv = document.createElement('div');
        specNameDiv.textContent = spec === 'Action' ? '' : spec + ':';
        stickySpecHeaderDiv.appendChild(specNameDiv);
    });
    specsDiv.appendChild(stickySpecHeaderDiv);

    const scrollableSpecHeaderDiv = document.createElement('div');
    scrollableSpecHeaderDiv.className = 'spec-scrollable-header';
    scrollableSpecs.forEach(spec => {
        const specNameDiv = document.createElement('div');
        specNameDiv.textContent = spec + ':';
        scrollableSpecHeaderDiv.appendChild(specNameDiv);
    });
    specsDiv.appendChild(scrollableSpecHeaderDiv);

    const inquirySpecHeaderDiv = document.createElement('div');
    inquirySpecHeaderDiv.className = 'spec-inquiry-header';
    inquirySpec.forEach(spec => {
        const specNameDiv = document.createElement('div');
        specNameDiv.textContent = '';
        inquirySpecHeaderDiv.appendChild(specNameDiv);
    });
    specsDiv.appendChild(inquirySpecHeaderDiv);

    container.appendChild(specsDiv);


    productsToCompare.forEach(product => {
        const productDiv = document.createElement('div');
        productDiv.className = 'comparison-product';
        const uniqueId = `${product['Model No.']}__${product['SoCset']}`;
        productDiv.dataset.uniqueId = uniqueId;

        const stickyDiv = document.createElement('div');
        stickyDiv.className = 'comparison-product-sticky';

        stickySpecs.forEach(spec => {
            const valueDiv = document.createElement('div');
            if (spec === 'Action') {
                valueDiv.classList.add('value-action');
                const removeBtn = document.createElement('button');
                removeBtn.textContent = 'Remove';
                removeBtn.className = 'comparison-remove-btn';
                removeBtn.onclick = () => {
                    viewedProductIds.delete(uniqueId);
                    renderComparisonView();
                    const tableButton = document.querySelector(`.details-button[data-unique-id="${uniqueId}"]`);
                    if(tableButton) {
                        tableButton.textContent = 'Add';
                        tableButton.disabled = false;
                        tableButton.style.backgroundColor = '';
                    }
                };
                valueDiv.appendChild(removeBtn);
            } else if (spec === 'Image') {
                valueDiv.classList.add('value-image');
                const img = document.createElement('img');
                const modelNo = product['Model No.'];
                const baseModelNo = modelNo.replace(/\s*\([ABab]\)\s*$/, '').trim();
                const imageName = baseModelNo.replace(/[\s()/]/g, '_');
                const imagePathPng = `images/${imageName}.png`;
                const imagePathJpg = `images/${imageName}.jpg`;
                img.alt = `Image of ${modelNo}`;
                img.style.opacity = '0';
                img.onerror = () => { img.onerror = () => { img.alt = 'Image N/A'; img.style.opacity = '1';}; img.src = imagePathJpg; };
                img.onload = () => { img.style.opacity = '1'; };
                img.src = imagePathPng;
                valueDiv.appendChild(img);
            }
            stickyDiv.appendChild(valueDiv);
        });
        productDiv.appendChild(stickyDiv);


        const scrollableDiv = document.createElement('div');
        scrollableDiv.className = 'comparison-product-scrollable';
        scrollableSpecs.forEach(spec => {
             const valueDiv = document.createElement('div');
             valueDiv.textContent = product[spec] ?? 'N/A';
             scrollableDiv.appendChild(valueDiv);
        });
        productDiv.appendChild(scrollableDiv);


        const inquiryDiv = document.createElement('div');
        inquiryDiv.className = 'comparison-product-scrollable';
        inquirySpec.forEach(spec => {
            const valueDiv = document.createElement('div');
            valueDiv.classList.add('value-inquiry');
            const inquiryBtn = document.createElement('button');
            inquiryBtn.textContent = '제품 문의하기';
            inquiryBtn.className = 'comparison-inquiry-btn';
            inquiryBtn.onclick = () => {
                if (GOOGLE_FORM_LINK && GOOGLE_FORM_LINK !== 'YOUR_GOOGLE_FORM_LINK_HERE') {
                    window.open(GOOGLE_FORM_LINK, '_blank');
                } else {
                    alert('문의 링크가 설정되지 않았습니다.');
                }
            };
            valueDiv.appendChild(inquiryBtn);
            inquiryDiv.appendChild(valueDiv);
        });
         productDiv.appendChild(inquiryDiv);


        container.appendChild(productDiv);
    });
}


function applyFiltersAndRender() {
    const currentFilteredData = filterData();
    renderFilters();
    renderDataTable(currentFilteredData);
    renderComparisonView();
}