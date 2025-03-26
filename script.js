document.addEventListener('DOMContentLoaded', () => {
    fetch('data.csv')
        .then(response => response.text())
        .then(csv => {
            const data = parseCSV(csv);
            renderTabs(data);
            renderDataTable(data);
        });
});

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
        values