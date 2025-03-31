const GOOGLE_FORM_LINK = 'YOUR_GOOGLE_FORM_LINK_HERE';

// --- ResizeObserver 변수 ---
let tableResizeObserver = null;

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
                applyFiltersAndRender(); // Initial render calls everything

                // --- 테이블 너비 동기화를 위한 ResizeObserver 설정 ---
                setupTableResizeObserver();

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
        // Close filter lists on outside click
        if (!target.closest('.tab') && !target.closest('.filter-list')) {
            const wasListOpen = document.querySelector('.filter-list[style*="display: block"]');
            if (wasListOpen) {
                // Re-apply filters only if a list was open and is now closing
                // applyFiltersAndRender(); // This might be too aggressive, consider if needed
            }
            closeAllFilterLists();
        }
    });

    // --- 테이블 컨테이너 ResizeObserver 설정 ---
    function setupTableResizeObserver() {
        const tableContainer = document.getElementById('table-container');
        if (!tableContainer) return;

        // Disconnect previous observer if exists
        if (tableResizeObserver) {
            tableResizeObserver.disconnect();
        }

        tableResizeObserver = new ResizeObserver(entries => {
            // Re-sync widths when container size changes (e.g., window resize)
            for (let entry of entries) {
                // Check if scrollable area is visible before syncing
                 const scrollableArea = document.getElementById('scrollable-data-area');
                 if (scrollableArea && scrollableArea.style.display !== 'none') {
                     syncHeaderWidths();
                 }
            }
        });

        tableResizeObserver.observe(tableContainer);
    }


    // --- Make render/apply functions globally accessible ---
    window.renderComparisonView = function() {
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
            specNameDiv.textContent = (spec === 'Action' || spec === 'Image') ? '' : spec + ':';
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
                        const tableButton = document.querySelector(`.details-button[data-unique-id="${uniqueId}"], .remove-from-table-btn[data-unique-id="${uniqueId}"]`);
                        if(tableButton) {
                            tableButton.textContent = 'Add';
                            tableButton.className = 'details-button';
                            tableButton.disabled = false;
                            tableButton.removeEventListener('click', handleRemoveFromTableClick);
                            tableButton.addEventListener('click', handleDetailsClick);
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
                scrollableDiv.appendChild(valueDiv);
            });
            productDiv.appendChild(scrollableDiv);

            container.appendChild(productDiv);
        });
    }

    window.applyFiltersAndRender = function() {
        const currentFilteredData = filterData();
        renderFilters();
        renderDataTable(currentFilteredData); // Renders table, then syncs widths
        renderComparisonView(); // Renders comparison view
    }

}); // End of DOMContentLoaded


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
                // Re-apply filters when closing the list to reflect potential changes
                // applyFiltersAndRender(); // Decide if needed based on UX
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
            // Apply filters immediately after selection change
            applyFiltersAndRender();
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
    const tableContainer = document.getElementById('table-container');
    const stickyHeaderRow = document.getElementById('sticky-header-row');
    const scrollableDataArea = document.getElementById('scrollable-data-area');
    const table = document.getElementById('data-table');
    const tbody = table.tBodies[0];
    const initialMsg = document.getElementById('initial-message');
    const noDataMsg = document.getElementById('no-data-message');

    if (!tableContainer || !stickyHeaderRow || !scrollableDataArea || !table || !tbody || !initialMsg || !noDataMsg) {
        console.error("Required elements not found for renderDataTable");
        return;
    }

    stickyHeaderRow.innerHTML = '';
    tbody.innerHTML = '';

    const hasActiveFilters = Object.keys(filters).some(key => filters[key].length > 0);

    if (!hasActiveFilters) {
        initialMsg.style.display = 'block';
        stickyHeaderRow.style.display = 'none';
        scrollableDataArea.style.display = 'none';
        noDataMsg.style.display = 'none';
        table.style.display = 'none';
        return;
    }

    initialMsg.style.display = 'none';

    if (data.length === 0) {
        noDataMsg.style.display = 'block';
        stickyHeaderRow.style.display = 'none';
        scrollableDataArea.style.display = 'none';
        table.style.display = 'none';
        return;
    }

    stickyHeaderRow.style.display = 'flex';
    scrollableDataArea.style.display = 'block';
    table.style.display = 'table';
    noDataMsg.style.display = 'none';

    const headerCellCompare = document.createElement('div');
    headerCellCompare.className = 'header-cell compare-column';
    headerCellCompare.textContent = 'Compare';
    stickyHeaderRow.appendChild(headerCellCompare);

    csvHeaders.forEach(headerText => {
        const headerCell = document.createElement('div');
        headerCell.className = 'header-cell';
        headerCell.textContent = headerText;
        const className = headerText.toLowerCase().replace(/[^a-z0-9\s]+/g, '').replace(/\s+/g, '-');
        headerCell.classList.add(`col-${className}`);
        stickyHeaderRow.appendChild(headerCell);
    });

    data.forEach(item => {
        const r = tbody.insertRow();

        const cellDetails = r.insertCell();
        cellDetails.className = 'compare-column';
        const btn = document.createElement('button');
        const modelNo = item['Model No.'];
        const socSet = item['SoCset'];
        const uniqueId = `${modelNo}__${socSet}`;

        if (modelNo && socSet) {
            btn.dataset.uniqueId = uniqueId;
            if (viewedProductIds.has(uniqueId)) {
                 btn.textContent = 'Remove';
                 btn.className = 'remove-from-table-btn';
                 btn.addEventListener('click', handleRemoveFromTableClick);
            } else {
                 btn.textContent = 'Add';
                 btn.className = 'details-button';
                 btn.addEventListener('click', handleDetailsClick);
            }
        } else {
            btn.disabled = true; btn.title = "Unique ID unavailable";
            btn.className = 'details-button';
        }
        cellDetails.appendChild(btn);

        csvHeaders.forEach(headerKey => {
            const cell = r.insertCell();
            cell.textContent = (item[headerKey] ?? '');
            const className = headerKey.toLowerCase().replace(/[^a-z0-9\s]+/g, '').replace(/\s+/g, '-');
            cell.classList.add(`col-${className}`);
        });
    });

    requestAnimationFrame(() => {
        syncHeaderWidths();
    });
}

function syncHeaderWidths() {
    const headerCells = document.querySelectorAll('#sticky-header-row .header-cell');
    const firstDataRow = document.querySelector('#data-table tbody tr:first-child');
    const scrollableDataArea = document.getElementById('scrollable-data-area');
    const stickyHeaderRow = document.getElementById('sticky-header-row');
    const dataTable = document.getElementById('data-table');

    if (!firstDataRow || headerCells.length === 0 || !scrollableDataArea || !stickyHeaderRow || !dataTable) {
        return; // Exit if elements aren't ready
    }
    const firstDataRowCells = firstDataRow.querySelectorAll('td');

    if (firstDataRowCells.length === 0 || headerCells.length !== firstDataRowCells.length) {
        console.warn("Cannot sync widths: Header and data cells mismatch.");
        return;
    }

    // 1. Reset widths to calculate natural header width needed
    headerCells.forEach(cell => {
        cell.style.width = 'auto';
        cell.style.minWidth = 'auto';
        cell.style.flexBasis = 'auto'; // Also reset flex-basis
    });
    // Reset data cell widths as well to avoid interference during measurement
    firstDataRowCells.forEach(cell => {
        cell.style.width = 'auto';
        cell.style.minWidth = 'auto';
    });
     // Reset table width
    dataTable.style.width = 'auto';
    dataTable.style.minWidth = 'auto';
    stickyHeaderRow.style.width = 'auto';
    stickyHeaderRow.style.minWidth = 'auto';


    // 2. Calculate required width for each header cell
    let totalHeaderWidth = 0;
    const columnWidths = [];

    headerCells.forEach((headerCell, i) => {
        // Add 1px buffer for potential rounding issues + border
        const requiredWidth = Math.max(headerCell.scrollWidth, firstDataRowCells[i].scrollWidth) + 2;
        columnWidths[i] = requiredWidth;
        totalHeaderWidth += requiredWidth;
    });

    // 3. Apply calculated widths to header and all data cells
    headerCells.forEach((headerCell, i) => {
        const widthPx = `${columnWidths[i]}px`;
        headerCell.style.minWidth = widthPx;
        headerCell.style.width = widthPx;
        headerCell.style.flexBasis = widthPx; // Set flex-basis too

        // Apply to all cells in this column, not just the first row
        const dataCellsInColumn = document.querySelectorAll(`#data-table td:nth-child(${i + 1})`);
        dataCellsInColumn.forEach(cell => {
            cell.style.minWidth = widthPx;
            cell.style.width = widthPx;
        });
    });

    // 4. Set container widths
    const finalWidthPx = `${totalHeaderWidth}px`;
    stickyHeaderRow.style.width = finalWidthPx;
    stickyHeaderRow.style.minWidth = finalWidthPx; // Ensure it doesn't shrink
    dataTable.style.width = finalWidthPx;
    dataTable.style.minWidth = finalWidthPx; // Ensure it doesn't shrink


    // 5. Compensate for vertical scrollbar in data area
    const scrollbarWidth = scrollableDataArea.offsetWidth - scrollableDataArea.clientWidth;
    if (scrollbarWidth > 0) {
        stickyHeaderRow.style.paddingRight = `${scrollbarWidth}px`;
        // Adjust total width calculation to potentially include scrollbar width?
        // Or ensure the container #table-container accounts for it.
    } else {
        stickyHeaderRow.style.paddingRight = '0px';
    }
}


function handleDetailsClick(event) {
    const button = event.target;
    const uniqueId = button.dataset.uniqueId;
    if (!uniqueId) return;

    if (!viewedProductIds.has(uniqueId)) {
        viewedProductIds.add(uniqueId);
        renderComparisonView();
        button.textContent = 'Remove';
        button.className = 'remove-from-table-btn';
        button.removeEventListener('click', handleDetailsClick);
        button.addEventListener('click', handleRemoveFromTableClick);
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

function handleRemoveFromTableClick(event) {
    const button = event.target;
    const uniqueId = button.dataset.uniqueId;
    if (!uniqueId) return;

    if (viewedProductIds.has(uniqueId)) {
        viewedProductIds.delete(uniqueId);
        renderComparisonView();
        button.textContent = 'Add';
        button.className = 'details-button';
        button.removeEventListener('click', handleRemoveFromTableClick);
        button.addEventListener('click', handleDetailsClick);
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