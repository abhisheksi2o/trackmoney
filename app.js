// Helpers
// Today's date as YYYY-MM-DD in the user's local time zone
// (toISOString() uses UTC, which gives yesterday's date in India before 5:30 AM)
function localDateStr(d = new Date()) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Escape user-entered text before putting it into innerHTML
function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function loadTransactions() {
    try {
        const saved = JSON.parse(localStorage.getItem('finance_transactions'));
        return Array.isArray(saved) ? saved : [];
    } catch (e) {
        return [];
    }
}

// Globals
let transactions = loadTransactions();
let chartInstance = null;

const monthSelector = document.getElementById('month-selector');
const transactionForm = document.getElementById('transaction-form');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Set default date in form to today
    const today = localDateStr();
    document.getElementById('date').value = today;

    // Set default month in selector to current month (YYYY-MM)
    const currentMonthStr = today.substring(0, 7);
    monthSelector.value = currentMonthStr;

    // Initial render
    updateDashboard();
});

// Handle form submission
transactionForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const type = document.getElementById('type').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const date = document.getElementById('date').value;
    const description = document.getElementById('description').value;

    const newTx = {
        id: Date.now().toString(),
        type,
        amount,
        date,
        description
    };

    transactions.push(newTx);
    saveData();
    
    // Reset form but keep date
    document.getElementById('amount').value = '';
    document.getElementById('description').value = '';
    
    // Automatically switch to the month of the transaction we just added
    const txMonth = date.substring(0, 7);
    if(monthSelector.value !== txMonth) {
        monthSelector.value = txMonth;
    }

    updateDashboard();
});

// Handle month change
monthSelector.addEventListener('change', updateDashboard);

function saveData() {
    localStorage.setItem('finance_transactions', JSON.stringify(transactions));
}

function deleteTransaction(id) {
    transactions = transactions.filter(tx => tx.id !== id);
    saveData();
    updateDashboard();
}

function updateDashboard() {
    // If the month picker was cleared, fall back to the current month
    if (!monthSelector.value) {
        monthSelector.value = localDateStr().substring(0, 7);
    }
    const selectedMonth = monthSelector.value; // Format: YYYY-MM
    
    // Display formatted month name
    const [year, month] = selectedMonth.split('-');
    const dateObj = new Date(year, month - 1);
    const monthName = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
    document.getElementById('current-month-display').innerText = monthName;

    // Filter transactions for selected month
    const filteredTx = transactions.filter(tx => tx.date.startsWith(selectedMonth));
    
    // Calculate aggregates
    let income = 0;
    let emi = 0;
    let premium = 0;
    let savings = 0;
    let living = 0;
    let discretionary = 0;

    filteredTx.forEach(tx => {
        if (tx.type === 'Income') income += tx.amount;
        else if (tx.type === 'EMI') emi += tx.amount;
        else if (tx.type === 'Premium') premium += tx.amount;
        else if (tx.type === 'Savings') savings += tx.amount;
        else if (tx.type === 'Living') living += tx.amount;
        else if (tx.type === 'Discretionary') discretionary += tx.amount;
    });

    const needs = emi + premium + living;
    const wants = discretionary;
    const totalExpenses = needs + wants;
    const remaining = income - totalExpenses - savings;

    // Update Cards
    document.getElementById('card-income').innerText = `$${income.toFixed(2)}`;
    document.getElementById('card-expenses').innerText = `$${totalExpenses.toFixed(2)}`;
    document.getElementById('card-savings').innerText = `$${savings.toFixed(2)}`;
    document.getElementById('card-remaining').innerText = `$${remaining.toFixed(2)}`;
    
    // Update color for remaining
    const cardRemaining = document.getElementById('card-remaining');
    if (remaining < 0) {
        cardRemaining.classList.remove('text-gray-800');
        cardRemaining.classList.add('text-red-600');
    } else {
        cardRemaining.classList.remove('text-red-600');
        cardRemaining.classList.add('text-gray-800');
    }

    // Render Transaction List
    renderTransactionList(filteredTx);

    // Render Chart
    renderChart(needs, wants, savings, remaining);

    // Generate Insights
    generateInsights(income, needs, wants, savings, remaining, monthName);
}

function renderTransactionList(filteredTx) {
    const list = document.getElementById('transaction-list');
    const noTx = document.getElementById('no-transactions');
    list.innerHTML = '';

    if (filteredTx.length === 0) {
        noTx.classList.remove('hidden');
        return;
    }
    
    noTx.classList.add('hidden');

    // Sort descending by date
    filteredTx.sort((a, b) => new Date(b.date) - new Date(a.date));

    filteredTx.forEach(tx => {
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-200';
        
        let iconClass, amountColor, sign;
        if (tx.type === 'Income') {
            iconClass = 'text-green-500 fas fa-arrow-down';
            amountColor = 'text-green-600';
            sign = '+';
        } else if (tx.type === 'Savings') {
            iconClass = 'text-teal-500 fas fa-piggy-bank';
            amountColor = 'text-teal-600';
            sign = '-';
        } else {
            iconClass = 'text-red-500 fas fa-arrow-up';
            amountColor = 'text-red-600';
            sign = '-';
        }

        li.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="w-8 h-8 rounded-full bg-white shadow flex items-center justify-center ${amountColor}">
                    <i class="${iconClass} text-sm"></i>
                </div>
                <div>
                    <p class="text-sm font-semibold text-gray-800">${escapeHTML(tx.description)}</p>
                    <p class="text-xs text-gray-500">${escapeHTML(tx.date)} • ${escapeHTML(tx.type)}</p>
                </div>
            </div>
            <div class="flex items-center space-x-3">
                <span class="font-bold ${amountColor}">${sign}$${tx.amount.toFixed(2)}</span>
                <button onclick="deleteTransaction('${tx.id}')" class="text-gray-400 hover:text-red-500" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        list.appendChild(li);
    });
}

function renderChart(needs, wants, savings, remaining) {
    // If the Chart.js CDN failed to load, skip the chart instead of
    // crashing (which would also stop the insights from rendering)
    if (typeof Chart === 'undefined') return;

    const ctx = document.getElementById('expenseChart').getContext('2d');

    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    if (needs === 0 && wants === 0 && savings === 0 && remaining <= 0) {
        return; // Nothing to draw
    }

    const data = [needs, wants, savings];
    const labels = ['Needs', 'Wants', 'Savings'];
    const colors = ['#EF4444', '#F59E0B', '#14B8A6'];

    if (remaining > 0) {
        data.push(remaining);
        labels.push('Unallocated');
        colors.push('#9CA3AF');
    }

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12 }
                }
            }
        }
    });
}

function generateInsights(income, needs, wants, savings, remaining, monthName) {
    const insightsList = document.getElementById('insights-list');
    insightsList.innerHTML = '';
    
    if (income <= 0) {
        insightsList.innerHTML = '<li class="text-gray-500 italic text-center mt-4">Add your Income for this month to generate smart insights based on the 50/30/20 rule.</li>';
        return;
    }

    const needsPct = (needs / income) * 100;
    const wantsPct = (wants / income) * 100;
    const savingsPct = (savings / income) * 100;

    const rules = [
        {
            condition: needsPct > 50,
            icon: '<i class="fas fa-exclamation-triangle text-red-500"></i>',
            title: 'Needs High',
            text: `Your essential expenses (EMI, Premium, Living) are at <strong>${needsPct.toFixed(1)}%</strong> of your income (Limit: 50%). Try reducing grocery or utility costs if possible.`
        },
        {
            condition: needsPct <= 50 && needs > 0,
            icon: '<i class="fas fa-check-circle text-green-500"></i>',
            title: 'Needs Optimal',
            text: `Great job! Your essential expenses are well under the 50% limit at <strong>${needsPct.toFixed(1)}%</strong>.`
        },
        {
            condition: wantsPct > 30,
            icon: '<i class="fas fa-exclamation-triangle text-red-500"></i>',
            title: 'Wants High',
            text: `Discretionary spending is at <strong>${wantsPct.toFixed(1)}%</strong> (Limit: 30%). For the rest of ${monthName}, cut back on dining out or shopping.`
        },
        {
            condition: wantsPct <= 30 && wants > 0,
            icon: '<i class="fas fa-check-circle text-green-500"></i>',
            title: 'Wants Optimal',
            text: `Your discretionary spending is controlled at <strong>${wantsPct.toFixed(1)}%</strong>.`
        },
        {
            condition: savingsPct < 20,
            icon: '<i class="fas fa-piggy-bank text-yellow-500"></i>',
            title: 'Low Savings',
            text: `You have saved <strong>${savingsPct.toFixed(1)}%</strong> so far. Your target should be at least 20%. Consider transferring $${((income * 0.20) - savings).toFixed(2)} to savings.`
        },
        {
            condition: savingsPct >= 20,
            icon: '<i class="fas fa-star text-yellow-400"></i>',
            title: 'Excellent Savings',
            text: `You've hit the 20% savings target! You are saving <strong>${savingsPct.toFixed(1)}%</strong> of your income.`
        },
        {
            condition: remaining < 0,
            icon: '<i class="fas fa-skull-crossbones text-red-600"></i>',
            title: 'Deficit Alert',
            text: `You have spent $${Math.abs(remaining).toFixed(2)} more than you earned this month! Stop non-essential spending immediately.`
        },
        {
            condition: remaining > 0 && remaining > (income * 0.1), // more than 10% unallocated
            icon: '<i class="fas fa-lightbulb text-blue-500"></i>',
            title: 'Unallocated Funds',
            text: `You have a healthy buffer of $${remaining.toFixed(2)}. Consider putting some of this towards an emergency fund or investments.`
        }
    ];

    let hasInsights = false;
    rules.forEach(rule => {
        if (rule.condition) {
            hasInsights = true;
            const li = document.createElement('li');
            li.className = 'flex items-start space-x-3 bg-gray-50 p-3 rounded border border-gray-100';
            li.innerHTML = `
                <div class="mt-1">${rule.icon}</div>
                <div>
                    <h3 class="font-semibold text-gray-800">${rule.title}</h3>
                    <p class="text-gray-600 text-sm mt-1">${rule.text}</p>
                </div>
            `;
            insightsList.appendChild(li);
        }
    });

    if (!hasInsights) {
        insightsList.innerHTML = '<li class="text-gray-500 text-sm">Add some expenses to generate insights.</li>';
    }
}
