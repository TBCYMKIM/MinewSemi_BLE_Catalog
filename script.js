document.addEventListener('DOMContentLoaded', () => {
    fetch('data.csv')
        .then(response => response.text())
        .then(csv => {
            const data = parseCSV(csv);
            originalData = data; // 원본 데이터 저장
            renderTabs(data);
            renderDataTable(data);
        });
});

let originalData = []; // 전역 변수 선언

function parseCSV(csv) {
    const lines = csv.split('\n');
    const headers = lines[0].split('\t');
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split('\t');
        if (values.length === headers.length) {
            const row = {};
            for (let j = 0; j < headers.length; j++) {
                row[headers[j]] = values[j];
            }
            data.push(row);
        }
    }
    return data;
}

function renderTabs(data) {
    const filterContainer = document.getElementById('filter-container');
    const headers = Object.keys(data[0]);

    headers.forEach(header => {
        const tab = document.createElement('div');
        tab.classList.add('tab');
        tab.textContent = header;
        filterContainer.appendChild(tab);

        const filterList = document.createElement('ul');
        filterList.classList.add('filter-list');
        filterList.style.display = 'none';

        const uniqueValues = [...new Set(data.map(item => {
            if (['Certification'].includes(header)) {
                return item[header].split(',')[0].trim();
            } else if (['Max Range (M)', 'Max Length (mm)', 'Mid Length (mm)', 'Min Length (mm)', 'Flash (KB)', 'RAM (KB)', 'Reception Sensitivity (dBm)', 'Transmission Power (min, dBM)', 'Transmission Power (max, dBM)', 'Current (TX, mA)', 'Current (RX, mA)', 'GPIO'].includes(header)) {
                return item[header];
            } else {
                return item[header];
            }
        }))];

        uniqueValues.forEach(value => {
            const listItem = document.createElement('li');
            listItem.textContent = value;
            listItem.addEventListener('click', () => {
                addFilter(header, value);
                filterList.style.display = 'none';
            });
            filterList.appendChild(listItem);
        });

        tab.addEventListener('click', () => {
            if (filterList.style.display === 'block') {
                filterList.style.display = 'none';
            } else {
                filterList.style.display = 'block';
            }
        });

        filterContainer.appendChild(filterList);
    });
}

const filters = {};

function addFilter(header, value) {
    if (!filters[header]) {
        filters[header] = [];
    }
    filters[header].push(value);
    renderFilters();
    renderDataTable(filterData());
}

function removeFilter(header, value) {
    filters[header] = filters[header].filter(item => item !== value);
    if (filters[header].length === 0) {
        delete filters[header];
    }
    renderFilters();
    renderDataTable(filterData());
}

function renderFilters() {
    const filterContainer = document.getElementById('filter-container');
    const existingFilters = document.querySelectorAll('.filter');
    existingFilters.forEach(filter => filter.remove());

    Object.entries(filters).forEach(([header, values]) => {
        values.forEach(value => {
            const filterElement = document.createElement('div');
            filterElement.classList.add('filter');
            filterElement.textContent = `${header}: ${value}`;

            const removeButton = document.createElement('span');
            removeButton.classList.add('remove-filter');
            removeButton.textContent = 'x';
            removeButton.addEventListener('click', () => {
                removeFilter(header, value);
            });

            filterElement.appendChild(removeButton);
            filterContainer.appendChild(filterElement);
        });
    });
}

function filterData() {
    let filteredData = [...originalData]; // 원본 데이터를 복사
    Object.entries(filters).forEach(([header, values]) => {
        filteredData = filteredData.filter(item => {
            if (['Certification'].includes(header)) {
                return values.some(val => item[header].split(',').map(v => v.trim()).includes(val));
            } else {
                return values.includes(item[header]);
            }
        });
    });
    return filteredData;
}

function renderDataTable(data) {
    const dataTable = document.getElementById('data-table');
    dataTable.innerHTML = ''; // 테이블 초기화

    if (data.length === 0) {
        dataTable.innerHTML = '<p>No data available.</p>';
        return;
    }

    const headers = Object.keys(data[0]);
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    dataTable.appendChild(headerRow);

    data.forEach(item => {
        const row = document.createElement('tr');
        headers.forEach(header => {
            const td = document.createElement('td');
            td.textContent = item[header];
            row.appendChild(td);
        });
        dataTable.appendChild(row);
    });
}
