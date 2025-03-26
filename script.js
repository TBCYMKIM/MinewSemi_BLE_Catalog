fetch('data.csv')
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
    })
    .then(csv => {
        const data = parseCSV(csv);
        displayTable(data);
        setupFilters(data);
        displayAdditionalText();
    })
    .catch(error => {
        console.error('Error fetching data:', error);
        document.body.innerHTML = '<p>데이터를 불러오는 중 오류가 발생했습니다.</p>';
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
    const tableHeader = document.querySelector('#productTable thead tr');
    tableHeader.innerHTML = '';

    if (data.length > 0) {
        Object.keys(data[0]).forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            tableHeader.appendChild(th);
        });
    }

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
