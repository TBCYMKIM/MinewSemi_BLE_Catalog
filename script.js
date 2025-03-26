document.addEventListener('DOMContentLoaded', () => {
    fetch('data.csv')
        .then(response => response.text())
        .then(csv => {
            const data = parseCSV(csv);
            originalData = data;
            renderTabs(data);
            renderDataTable(data);
        });
});

let originalData = [];
let filters = {};

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
    const chipsetVendors = [...new Set(data.map(item => item['Chipset Vendor']))];

    chipsetVendors.forEach(vendor => {
        const tab = document.createElement('div');
        tab.classList.add('tab');
        tab.textContent = vendor;
        filterContainer.appendChild(tab);

        const filterList = document.createElement('ul');
        filterList.classList.add('filter-list');
        filterList.style.display = 'none';

        const uniqueValues = [...new Set(data.map(item => item['Chipset Vendor']))];

        uniqueValues.forEach(value => {
            const listItem = document.createElement('li');
            listItem.textContent = value;
            listItem.addEventListener('click', () => {
                addFilter('Chipset Vendor', value);
                filterList.style.display = 'none';
            });
            filterList.appendChild(listItem);
        });

        tab.addEventListener('click', () => {
            const lists = document.querySelectorAll('.filter-list');
            lists.forEach(list => list.style.display = 'none';
            filterList.style.display = filterList.style.display === 'block' ? 'none' : 'block';
        });

        filterContainer.appendChild(filterList);
    });
}

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
    let filteredData = [...originalData];
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
    dataTable.innerHTML = '';

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
