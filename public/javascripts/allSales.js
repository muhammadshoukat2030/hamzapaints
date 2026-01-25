document.addEventListener('DOMContentLoaded', () => {
    let dbDefinitions = [];
    const provider = document.getElementById('db-data-provider');
    
    // 1. Load Data
    if (provider && provider.getAttribute('data-definitions')) {
        try {
            dbDefinitions = JSON.parse(provider.getAttribute('data-definitions'));
            console.log("✅ Data Loaded Successfully");
        } catch (e) {
            console.error("❌ Parse Error:", e);
        }
    }

    const brandFilter = document.getElementById('brandFilter');
    const itemFilter = document.getElementById('itemNameFilter');
    const colourFilter = document.getElementById('colourNameFilter');
    const unitFilter = document.getElementById('unitFilter');
    const filterForm = document.getElementById('filterForm');

    // 2. Dropdown Sync Logic
    function syncDropdowns(isInitial = false) {
        const selectedBrand = brandFilter.value;
        const preItem = itemFilter.getAttribute('data-selected');
        const preUnit = unitFilter.getAttribute('data-selected');

        itemFilter.innerHTML = '<option value="all">All Items</option>';
        unitFilter.innerHTML = '<option value="all">All Units</option>';
        colourFilter.innerHTML = '<option value="all">All Colours</option>';

        if (selectedBrand === 'all') {
            itemFilter.disabled = true;
            unitFilter.disabled = true;
            colourFilter.disabled = true;
            return;
        }

        const data = dbDefinitions.find(d => d.brandName === selectedBrand);

        if (data) {
            itemFilter.disabled = false;
            unitFilter.disabled = false;

            // Products
            if (data.products && Array.isArray(data.products)) {
                data.products.forEach(prod => {
                    const name = prod.itemName;
                    if (name) {
                        const opt = new Option(name, name);
                        if (isInitial && name === preItem) opt.selected = true;
                        itemFilter.add(opt);
                    }
                });
            }

            // Units
            if (data.units && Array.isArray(data.units)) {
                data.units.forEach(u => {
                    const opt = new Option(u, u);
                    if (isInitial && u === preUnit) opt.selected = true;
                    unitFilter.add(opt);
                });
            }
            syncColours(isInitial);
        }
    }

    function syncColours(isInitial = false) {
        const selectedBrand = brandFilter.value;
        const selectedItem = itemFilter.value;
        const preColor = colourFilter.getAttribute('data-selected');

        colourFilter.innerHTML = '<option value="all">All Colours</option>';

        if (selectedItem === 'all') {
            colourFilter.disabled = true;
            return;
        }

        const brandData = dbDefinitions.find(d => d.brandName === selectedBrand);
        
        if (brandData && brandData.products) {
            const selectedProduct = brandData.products.find(p => p.itemName === selectedItem);
            
            if (selectedProduct && selectedProduct.colors && Array.isArray(selectedProduct.colors)) {
                colourFilter.disabled = false;
                selectedProduct.colors.forEach(c => {
                    // Using your confirmed keys: 'colour' and 'code'
                    const cName = c.colour || "Unknown";
                    const cCode = c.code || "";
                    
                    const val = cCode ? `${cName} (Code: ${cCode})` : cName;
                    const opt = new Option(val, val);
                    if (isInitial && val === preColor) opt.selected = true;
                    colourFilter.add(opt);
                });
            } else {
                colourFilter.disabled = true;
            }
        }
    }

    // 3. AJAX Table & Stats Update
    async function updateTable() {
        const formData = new URLSearchParams(new FormData(filterForm)).toString();
        const tbody = document.querySelector('tbody');
        const loader = document.getElementById('table-loader');
        
        if(!tbody) return;
        if(loader) loader.style.display = 'block';
        tbody.style.opacity = '0.5';

        try {
            const res = await fetch(`/sales/all?${formData}`, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            const data = await res.json();
            
            if (data.success) {
                // Update Stats Boxes
                const statsPs = document.querySelectorAll('.stat-box p');
                if(statsPs.length >= 5) {
                    statsPs[0].innerText = data.stats.totalSold;
                    statsPs[1].innerText = `Rs ${data.stats.totalRevenue.toFixed(2)}`;
                    statsPs[2].innerText = `Rs ${data.stats.totalProfit.toFixed(2)}`;
                    statsPs[3].innerText = `Rs ${data.stats.totalLoss.toFixed(2)}`;
                    statsPs[4].innerText = `Rs ${data.stats.totalRefunded.toFixed(2)}`;
                }

                // Update Table Rows
                let html = '';
                if (data.sales.length === 0) {
                    html = '<tr><td colspan="12" style="text-align:center; padding:20px;">No records found</td></tr>';
                } else {
                   data.sales.forEach(s => {
    // 🟢 Date and Time formatting to match EJS exactly
    const dateOptions = { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Karachi' };

    const dateStr = new Date(s.createdAt).toLocaleDateString('en-GB', dateOptions);
    const timeStr = new Date(s.createdAt).toLocaleTimeString('en-GB', timeOptions);

    html += `<tr>
        <td>${s.brandName}</td>
        <td>${s.itemName}</td>
        <td>${s.colourName}</td>
        <td>${s.qty}</td>
        <td>${s.quantitySold}</td>
        <td>Rs ${s.rate.toFixed(2)}</td>
        <td>Rs ${(s.quantitySold * s.rate).toFixed(2)}</td>
        <td class="${s.profit < 0 ? 'loss' : 'profit'}">Rs ${s.profit.toFixed(2)}</td>
        <td class="refund-status">${s.refundStatus || 'none'}</td>
        <td class="refund-quantity">${s.refundQuantity || 0}</td>
        <td>
            ${dateStr}
            <br>
            <small style="color: #007bff; font-weight: bold;">${timeStr}</small>
        </td>
        <td><button class="delete-sale delete-btn" data-id="${s._id}" id="delete">Delete</button></td>
    </tr>`;
});
                }
                tbody.innerHTML = html;
                attachDelete();
            }
        } catch (e) { 
            console.error("Fetch Error:", e); 
        } finally { 
            tbody.style.opacity = '1'; 
            if(loader) loader.style.display = 'none';
        }
    }

    // 4. Event Listeners
    brandFilter.addEventListener('change', () => { 
        itemFilter.setAttribute('data-selected', 'all');
        syncDropdowns(); 
        updateTable(); 
    });

    itemFilter.addEventListener('change', () => { 
        colourFilter.setAttribute('data-selected', 'all');
        syncColours(); 
        updateTable(); 
    });

    [colourFilter, unitFilter, document.getElementById('refundFilter'), document.getElementById('filter')].forEach(el => {
        if(el) el.addEventListener('change', updateTable);
    });

   function attachDelete() {
    document.querySelectorAll('.delete-sale').forEach(btn => {
        btn.onclick = async () => {
            // 1. Pehle confirm karein
            const isConfirmed = confirm("Are you sure you want to delete this sale record?");
            
            if (isConfirmed) {
                try {
                    const res = await fetch(`/sales/delete-sale/${btn.dataset.id}`, { 
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    const data = await res.json();
                    
                    if (data.success) {
                        // 2. Success Message dikhayein
                        alert("✅ Sale deleted successfully!"); 
                        
                        // 3. Table ko update karein
                        updateTable();
                    } else {
                        // Agar backend se koi error aaye (e.g. Permission issue)
                        alert("❌ Error: " + (data.message || "Could not delete sale"));
                    }
                } catch (err) {
                    console.error("Delete Error:", err);
                    alert("❌ Server error! Please try again.");
                }
            }
        };
    });
}

    // Initial Run
    syncDropdowns(true);
    attachDelete();
});