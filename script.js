fetch('data.csv')
    .then(response => response.text())
    .then(csv => {
        const data = parseCSV(csv);
        displayTable(data);
        setupFilters(data);
    });

// ... (parseCSV, displayTable 함수) ...

function setupFilters(data) {
    const filtersDiv = document.getElementById('filters');
    const headers = Object.keys(data[0]);
    const selectedFilters = {}; // 선택된 필터를 저장하는 객체

    headers.forEach(header => {
        // ... (필터 바 생성 코드) ...

        const filterList = document.createElement('div');
        filterList.className = 'filter-list';
        filterList.style.display = 'none';

        if (['Chipset Vendor', 'Model Series', 'Model No.', 'Antenna', 'SoCset', 'Certification'].includes(header)) {
            const uniqueValues = [...new Set(data.map(item => item[header]))];
            uniqueValues.forEach(value => {
                const valueDiv = document.createElement('div');
                valueDiv.textContent = value;
                valueDiv.addEventListener('click', () => {
                    selectedFilters[header] = value;
                    updateFiltersDisplay(selectedFilters);
                    filterTable(data, selectedFilters);
                    filterList.style.display = 'none'; // 필터 목록 닫기
                });
                filterList.appendChild(valueDiv);
            });
        } else if (['Max Range (M)', 'Max Length (mm)', 'Mid Length (mm)', 'Min Length (mm)', 'Flash (KB)', 'RAM (KB)', 'Reception Sensitivity (dBm)', 'Transmission Power (min, dBm)', 'Transmission Power (max, dBm)', 'Current (TX, mA)', 'Current (RX, mA)', 'GPIO'].includes(header)) {
            const numericValues = data.map(item => parseFloat(item[header])).filter(value => !isNaN(value));
            const ranges = calculateRanges(numericValues);
            ranges.forEach(range => {
                const rangeDiv = document.createElement('div');
                rangeDiv.textContent = range.label;
                rangeDiv.addEventListener('click', () => {
                    selectedFilters[header] = { min: range.min, max: range.max };
                    updateFiltersDisplay(selectedFilters);
                    filterTable(data, selectedFilters);
                    filterList.style.display = 'none'; // 필터 목록 닫기
                });
                filterList.appendChild(rangeDiv);
            });
        }

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

// ... (calculateRanges, filterTableByRange 함수) ...
