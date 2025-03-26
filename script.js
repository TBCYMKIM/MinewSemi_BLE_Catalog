fetch('data.csv')
    .then(response => response.text())
    .then(csv => {
        const data = parseCSV(csv);
        displayTable(data);
        setupFilters(data);
    });

function parseCSV(csv) {
    const lines = csv.split('\n');
    const headers = lines[0].split(',');
    const results = [];

    for (let i = 1; i < lines.length; i++) {
        const obj = {};
        const currentLine = lines[i].split(',');

        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = currentLine[j];
        }
        results.push(obj);
    }
    return results;
}

function displayTable(data) {
    const tableBody = document.querySelector('#productTable tbody');
    tableBody.innerHTML = '';

    data.forEach(item => {
        const row = document.createElement('tr');
        Object.values(item).forEach(value => {
            const cell = document.createElement('td');
            cell.textContent = value;
            row.appendChild(cell);
        });
        tableBody.appendChild(row);
    });
}

function setupFilters(data) {
    const filtersDiv = document.getElementById('filters');
    const headers = Object.keys(data[0]);
    const selectedFilters = {};

    headers.forEach(header => {
        if (['Chipset Vendor', 'Model Series', 'Model No.', 'Antenna', 'SoCset', 'Certification'].includes(header)) {
            const filterBar = document.createElement('div');
            filterBar.className = 'filter-bar';
            filterBar.textContent = header;
            filtersDiv.appendChild(filterBar);

            const uniqueValues = [...new Set(data.map(item => item[header]))];
            const filterList = document.createElement('div');
            filterList.className = 'filter-list';
            filterList.style.display = 'none';

            uniqueValues.forEach(value => {
                const valueDiv = document.createElement('div');
                valueDiv.textContent = value;
                valueDiv.addEventListener('click', () => {
                    selectedFilters[header] = value;
                    updateFiltersDisplay(selectedFilters);
                    filterTable(data, selectedFilters);
                    filterList.style.display = 'none';
                });
                filterList.appendChild(valueDiv);
            });

            filterBar.addEventListener('click', (event) => {
                document.querySelectorAll('.filter-list').forEach(list => {
                    if (list !== filterList) {
                        list.style.display = 'none';
                    }
                });

                const rect = event.target.getBoundingClientRect();
                filterList.style.top = rect.bottom + window.scrollY + 'px';
                filterList.style.left = rect.left + window.scrollX + 'px';
                filterList.style.display = filterList.style.display === 'block' ? 'none' : 'block';
            });

            filtersDiv.appendChild(filterList);
        } else if (['Max Range (M)', 'Max Length (mm)', 'Mid Length (mm)', 'Min Length (mm)', 'Flash (KB)', 'RAM (KB)', 'Reception Sensitivity (dBm)', 'Transmission Power (min, dBm)', 'Transmission Power (max, dBm)', 'Current (TX, mA)', 'Current (RX, mA)', 'GPIO'].includes(header)) {
            const filterBar = document.createElement('div');
            filterBar.className = 'filter-bar';
            filterBar.textContent = header;
            filtersDiv.appendChild(filterBar);

            const numericValues = data.map(item => parseFloat(item[header])).filter(value => !isNaN(value));
            const ranges = calculateRanges(numericValues);

            const filterList = document.createElement('div');
            filterList.className = 'filter-list';
            filterList.style.display = 'none';

            ranges.forEach(range => {
                const rangeDiv = document.createElement('div');
                rangeDiv.textContent = range.label;
                rangeDiv.addEventListener('click', () => {
                    selectedFilters[header] = { min: range.min, max: range.max };
                    updateFiltersDisplay(selectedFilters);
                    filterTable(data, selectedFilters);
                    filterList.style.display = 'none';
                });
                filterList.appendChild(rangeDiv);
            });

            filterBar.addEventListener('click', (event) => {
                document.querySelectorAll('.filter-list').forEach(list => {
                    if (list !== filterList) {
                        list.style.display = 'none';
                    }
                });

                const rect = event.target.getBoundingClientRect();
                filterList.style.top = rect.bottom + window.scrollY + 'px';
                filterList.style.left = rect.left + window.scrollX + 'px';
                filterList.style.display = filterList.style.display === 'block' ? 'none' : 'block';
            });

            filtersDiv.appendChild(filterList);
        }
    });

    function updateFiltersDisplay(filters) {
        const displayDiv = document.getElementById('selectedFilters') || document.createElement('div');
        displayDiv.id = 'selectedFilters';
        displayDiv.innerHTML = '';
        for (const header in filters) {
            const filterValue = filters[header];
            const filterText = typeof filterValue === 'object' ? `${header}: ${filterValue.min} ~ ${filterValue.max}` : `${header}: ${filterValue}`;
            const filterElement = document.createElement('span');
            filterElement.textContent = filterText;
            const removeButton = document.createElement('span');
            removeButton.textContent = ' x ';
            removeButton.style.cursor = 'pointer';
            removeButton.addEventListener('click', () => {
                delete filters[header];
                updateFiltersDisplay(filters);
                filterTable(data, filters);
            });
            filterElement.appendChild(removeButton);
            displayDiv.appendChild(filterElement);
        }
        filtersDiv.parentNode.insertBefore(displayDiv, filtersDiv.nextSibling);
    }

    function filterTable(data, filters) {
        let filteredData = data;
        for (const header in filters) {
            const filterValue = filters[header];
            if (typeof filterValue === 'object') {
                filteredData = filteredData.filter(item => {
                    const numericValue = parseFloat(item[header]);
                    return !isNaN(numericValue) && numericValue >= filterValue.min && numericValue <= filterValue.max;
                });
            } else {
                filteredData = filteredData.filter(item => item[header] === filterValue);
            }
        }
        displayTable(filteredData);
    }
}

function calculateRanges(values) {
    const uniqueValues = [...new Set(values)].sort((a, b) => a - b);
    const ranges = [];

    if (uniqueValues.length <= 3) {
        uniqueValues.forEach(value => {
            ranges.push({ min: value, max: value, label: value.toString() });
        });
    } else {
        const middleIndex = Math.floor(uniqueValues.length / 2);
        const middleValue = uniqueValues[middleIndex];
        const range1 = { min: Math.min(...uniqueValues), max: middleValue - 1, label: `~ ${middleValue - 1}` };
        const range2 = { min: middleValue, max: middleValue, label: middleValue.toString() };
        const range3 = { min: middleValue + 1, max: Math.max(...uniqueValues), label: `${middleValue + 1} ~` };
        ranges.push(range1, range2, range3);
    }
    return ranges;
}

function filterTableByRange(data, header, min, max) {
    const filteredData = data.filter(item => {
        const numericValue = parseFloat(item[header]);
        return !isNaN(numericValue) && numericValue >= min && numericValue <= max;
    });
    displayTable(filteredData);
}
