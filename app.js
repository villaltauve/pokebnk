document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'pkbankUser';
    const DEFAULT_USER = {
        name: 'Ash Ketchum',
        pin: '1234',
        account: '0987654321',
        balance: 500.0,
        transactions: []
    };

    const currencyFormatter = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    });

    const loginSection = document.getElementById('login-section');
    const atmSection = document.getElementById('atm-section');
    const loginForm = document.getElementById('login-form');
    const pinInput = document.getElementById('pin-input');
    const loginErrorBox = document.getElementById('login-error');

    const userNameEl = document.getElementById('user-name');
    const accountNumberEl = document.getElementById('account-number');
    const balanceAmountEl = document.getElementById('balance-amount');
    const currentBalanceEl = document.getElementById('current-balance');

    const optionButtons = document.querySelectorAll('[data-transaction]');
    const transactionSections = document.querySelectorAll('[data-transaction-section]');
    const resetButtons = document.querySelectorAll('[data-reset]');

    const depositForm = document.getElementById('deposit-form');
    const depositErrorBox = document.getElementById('deposit-error');
    const depositSuccessBox = document.getElementById('deposit-success');
    const depositAmountInput = document.getElementById('deposit-amount');
    const depositDescriptionInput = document.getElementById('deposit-description');

    const withdrawForm = document.getElementById('withdraw-form');
    const withdrawErrorBox = document.getElementById('withdraw-error');
    const withdrawSuccessBox = document.getElementById('withdraw-success');
    const withdrawAmountInput = document.getElementById('withdraw-amount');
    const withdrawDescriptionInput = document.getElementById('withdraw-description');

    const paymentForm = document.getElementById('payment-form');
    const paymentErrorBox = document.getElementById('payment-error');
    const paymentSuccessBox = document.getElementById('payment-success');
    const paymentServiceInput = document.getElementById('payment-service');
    const paymentReferenceInput = document.getElementById('payment-reference');
    const paymentAmountInput = document.getElementById('payment-amount');

    const balanceSuccessBox = document.getElementById('balance-success');
    const balanceInquiryButton = document.getElementById('balance-inquiry-btn');

    const transactionsTableBody = document.getElementById('transactions-table');
    const transactionsChartCanvas = document.getElementById('transactions-chart');

    const receiptBanner = document.getElementById('receipt-banner');
    const receiptSummary = document.getElementById('receipt-summary');
    const printReceiptButton = document.getElementById('print-receipt-btn');
    const exitButton = document.getElementById('exit-btn');

    let userData = loadUserData();
    let lastTransaction = null;
    let transactionsChart = null;

    /* Initialization helpers */

    function loadUserData() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                return normaliseUserData(parsed);
            } catch (error) {
                console.warn('No fue posible leer los datos guardados. Se restaurará la configuración inicial.', error);
            }
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_USER));
        return normaliseUserData(DEFAULT_USER);
    }

    function normaliseUserData(data) {
        const safeData = {
            name: data.name || DEFAULT_USER.name,
            pin: data.pin || DEFAULT_USER.pin,
            account: data.account || DEFAULT_USER.account,
            balance: typeof data.balance === 'number' ? data.balance : Number.parseFloat(data.balance) || DEFAULT_USER.balance,
            transactions: Array.isArray(data.transactions) ? data.transactions : []
        };
        safeData.balance = roundToTwo(safeData.balance);
        return safeData;
    }

    function saveUserData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    }

    /* Utility helpers */

    function roundToTwo(value) {
        return Math.round(value * 100) / 100;
    }

    function parseAmount(value) {
        if (typeof value !== 'string') {
            return NaN;
        }
        const cleaned = value.replace(',', '.');
        const parsed = Number.parseFloat(cleaned);
        return Number.isNaN(parsed) ? NaN : roundToTwo(parsed);
    }

    function formatCurrency(value) {
        return currencyFormatter.format(roundToTwo(Number(value) || 0));
    }

    function formatDate(isoString) {
        try {
            return new Date(isoString).toLocaleString('es-MX', {
                dateStyle: 'short',
                timeStyle: 'short'
            });
        } catch {
            return isoString;
        }
    }

    function showElement(element) {
        if (element) {
            element.classList.remove('d-none');
        }
    }

    function hideElement(element) {
        if (element) {
            element.classList.add('d-none');
        }
    }

    function showMessage(element, messages, variant = 'error') {
        if (!element) {
            return;
        }
        const list = Array.isArray(messages) ? messages : [messages];
        element.classList.remove('d-none', 'alert-danger', 'alert-success', 'alert-info');
        const variantClass = variant === 'success' ? 'alert-success' : variant === 'info' ? 'alert-info' : 'alert-danger';
        element.classList.add(variantClass);
        element.innerHTML = list.map((msg) => `<div>${msg}</div>`).join('');
    }

    function hideMessage(element) {
        if (!element) {
            return;
        }
        element.classList.add('d-none');
        element.classList.remove('alert-danger', 'alert-success', 'alert-info');
        element.innerHTML = '';
    }

    function flattenErrors(errorObject) {
        if (!errorObject || typeof errorObject !== 'object') {
            return [];
        }
        return Object.values(errorObject).flat();
    }

    function clearFormMessages() {
        [
            depositErrorBox,
            depositSuccessBox,
            withdrawErrorBox,
            withdrawSuccessBox,
            paymentErrorBox,
            paymentSuccessBox,
            balanceSuccessBox
        ].forEach(hideMessage);
    }

    function updateUserSummary() {
        if (userNameEl) {
            userNameEl.textContent = userData.name;
        }
        if (accountNumberEl) {
            accountNumberEl.textContent = userData.account;
        }
    }

    function updateBalanceDisplays() {
        const formattedBalance = formatCurrency(userData.balance);
        if (balanceAmountEl) {
            balanceAmountEl.textContent = formattedBalance;
        }
        if (currentBalanceEl) {
            currentBalanceEl.textContent = formattedBalance;
        }
    }

    function getSignedAmount(transaction) {
        const amount = Number(transaction?.amount) || 0;
        if (transaction?.type === 'Depósito') {
            return amount;
        }
        if (transaction?.type === 'Consulta de saldo') {
            return 0;
        }
        return -amount;
    }

    function buildTransactionDetail(transaction) {
        if (!transaction) {
            return '';
        }
        if (transaction.type === 'Pago de servicio') {
            const fragments = [
                transaction.service ? `Servicio: ${transaction.service}` : null,
                transaction.reference ? `Referencia: ${transaction.reference}` : null,
                transaction.description || null
            ].filter(Boolean);
            return fragments.length ? fragments.join(' | ') : 'Pago de servicio';
        }
        if (transaction.description) {
            return transaction.description;
        }
        switch (transaction.type) {
            case 'Depósito':
                return 'Depósito en cuenta';
            case 'Retiro':
                return 'Retiro de efectivo';
            case 'Consulta de saldo':
                return 'Revisión de saldo disponible';
            default:
                return '';
        }
    }

    function getTransactionTypeClass(type) {
        switch (type) {
            case 'Depósito':
                return 'type-deposit';
            case 'Retiro':
                return 'type-withdraw';
            case 'Pago de servicio':
                return 'type-payment';
            case 'Consulta de saldo':
                return 'type-transfer';
            default:
                return '';
        }
    }

    function renderTransactions() {
        if (!transactionsTableBody) {
            return;
        }
        transactionsTableBody.innerHTML = '';
        const transactions = Array.isArray(userData.transactions) ? [...userData.transactions] : [];

        if (!transactions.length) {
            const emptyRow = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 5;
            cell.classList.add('text-center', 'text-muted');
            cell.textContent = 'No se han registrado transacciones todavía.';
            emptyRow.appendChild(cell);
            transactionsTableBody.appendChild(emptyRow);
            return;
        }

        const sorted = transactions.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateB - dateA;
        });

        sorted.forEach((transaction) => {
            const row = document.createElement('tr');

            const dateCell = document.createElement('td');
            dateCell.classList.add('text-center');
            dateCell.textContent = formatDate(transaction.date);
            row.appendChild(dateCell);

            const typeCell = document.createElement('td');
            typeCell.classList.add('text-center');
            const typeBadge = document.createElement('span');
            typeBadge.classList.add('transaction-type');
            const typeClass = getTransactionTypeClass(transaction.type);
            if (typeClass) {
                typeBadge.classList.add(typeClass);
            }
            typeBadge.textContent = transaction.type;
            typeCell.appendChild(typeBadge);
            row.appendChild(typeCell);

            const detailCell = document.createElement('td');
            detailCell.textContent = buildTransactionDetail(transaction);
            row.appendChild(detailCell);

            const amountCell = document.createElement('td');
            amountCell.classList.add('text-right', 'amount');
            const signedAmount = getSignedAmount(transaction);
            if (signedAmount === 0) {
                amountCell.textContent = '—';
            } else {
                amountCell.textContent = formatCurrency(signedAmount);
                amountCell.classList.add(signedAmount > 0 ? 'amount-positive' : 'amount-negative');
            }
            row.appendChild(amountCell);

            const balanceCell = document.createElement('td');
            balanceCell.classList.add('text-right');
            const balanceAfter = transaction.balanceAfter ?? userData.balance;
            balanceCell.textContent = formatCurrency(balanceAfter);
            row.appendChild(balanceCell);

            transactionsTableBody.appendChild(row);
        });
    }

    function updateChart() {
        if (!transactionsChartCanvas || typeof Chart === 'undefined') {
            return;
        }
        const categories = ['Depósito', 'Retiro', 'Pago de servicio', 'Consulta de saldo'];
        const counts = categories.map((type) =>
            (userData.transactions || []).filter((tx) => tx.type === type).length
        );

        if (!transactionsChart) {
            transactionsChart = new Chart(transactionsChartCanvas, {
                type: 'bar',
                data: {
                    labels: categories,
                    datasets: [
                        {
                            data: counts,
                            backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#1e3a8a'],
                            borderRadius: 6,
                            maxBarThickness: 60
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const value = context.parsed.y;
                                    const suffix = value === 1 ? '' : 'es';
                                    return `${value} transacción${suffix}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0,
                                stepSize: 1
                            }
                        }
                    }
                }
            });
        } else {
            transactionsChart.data.datasets[0].data = counts;
            transactionsChart.update();
        }
    }

    function setLastTransaction(transaction) {
        lastTransaction = transaction || null;
        updateReceiptBanner();
    }

    function updateReceiptBanner() {
        if (!receiptBanner || !receiptSummary) {
            return;
        }
        receiptSummary.innerHTML = '';
        if (!lastTransaction) {
            hideElement(receiptBanner);
            return;
        }

        const strongLabel = document.createElement('strong');
        strongLabel.textContent = 'Última transacción: ';
        receiptSummary.appendChild(strongLabel);

        const signedAmount = getSignedAmount(lastTransaction);
        const fragments = [
            formatDate(lastTransaction.date),
            lastTransaction.type
        ];

        if (signedAmount !== 0) {
            fragments.push(formatCurrency(signedAmount));
        }

        const balanceAfter = lastTransaction.balanceAfter ?? userData.balance;
        fragments.push(`Saldo: ${formatCurrency(balanceAfter)}`);

        receiptSummary.appendChild(document.createTextNode(fragments.join(' · ')));
        showElement(receiptBanner);
    }

    function showTransactionSection(sectionName) {
        transactionSections.forEach((section) => section.classList.add('d-none'));
        clearFormMessages();

        if (!sectionName) {
            return;
        }
        const targetSection = document.querySelector(`[data-transaction-section="${sectionName}"]`);
        if (!targetSection) {
            return;
        }
        targetSection.classList.remove('d-none');

        switch (sectionName) {
            case 'deposit':
                if (depositAmountInput) {
                    depositAmountInput.focus();
                }
                break;
            case 'withdraw':
                if (withdrawAmountInput) {
                    withdrawAmountInput.focus();
                }
                break;
            case 'payment':
                if (paymentServiceInput) {
                    paymentServiceInput.focus();
                }
                break;
            case 'balance':
                updateBalanceDisplays();
                break;
            default:
                break;
        }
    }

    function updateAfterTransaction(transaction) {
        saveUserData();
        updateBalanceDisplays();
        renderTransactions();
        updateChart();
        setLastTransaction(transaction);
    }

    function generateReceiptPDF(transaction) {
        const jspdf = window.jspdf;
        if (!jspdf || typeof jspdf.jsPDF !== 'function') {
            alert('No fue posible generar el comprobante PDF. Verifique la carga de jsPDF.');
            return;
        }

        const doc = new jspdf.jsPDF();
        const marginLeft = 20;
        let cursorY = 25;

        doc.setFontSize(18);
        doc.text('Pokémon Bank', marginLeft, cursorY);
        cursorY += 8;

        doc.setFontSize(12);
        doc.text('Sistema de Cajero Automático', marginLeft, cursorY);
        cursorY += 6;

        doc.setLineWidth(0.5);
        doc.line(marginLeft, cursorY, 190, cursorY);
        cursorY += 12;

        const lines = [
            `Fecha: ${formatDate(transaction.date)}`,
            `Cliente: ${userData.name}`,
            `Cuenta: ${userData.account}`,
            `Tipo de transacción: ${transaction.type}`
        ];

        const absoluteAmount = Math.abs(getSignedAmount(transaction));
        if (transaction.type === 'Consulta de saldo') {
            lines.push('Monto: ----');
        } else {
            lines.push(`Monto: ${formatCurrency(absoluteAmount)}`);
        }

        if (transaction.service) {
            lines.push(`Servicio: ${transaction.service}`);
        }

        if (transaction.reference) {
            lines.push(`Referencia: ${transaction.reference}`);
        }

        if (transaction.description) {
            lines.push(`Detalle: ${transaction.description}`);
        }

        const balanceAfter = transaction.balanceAfter ?? userData.balance;
        lines.push(`Saldo posterior: ${formatCurrency(balanceAfter)}`);

        lines.forEach((line) => {
            doc.text(line, marginLeft, cursorY);
            cursorY += 8;
        });

        cursorY += 4;
        doc.setFontSize(10);
        doc.text('Gracias por utilizar Pokémon Bank. Para cualquier duda comuníquese con nuestro centro de atención.', marginLeft, cursorY);

        const sanitizedType = (transaction.type || 'comprobante').replace(/\s+/g, '_').toLowerCase();
        const filename = `comprobante_${sanitizedType}_${transaction.id || Date.now()}.pdf`;
        doc.save(filename);
    }

    function logout() {
        showTransactionSection(null);
        hideElement(atmSection);
        showElement(loginSection);
        setLastTransaction(null);
        loginForm.reset();
        if (pinInput) {
            pinInput.value = '';
            pinInput.focus();
        }
    }

    /* Event listeners */

    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            hideMessage(loginErrorBox);

            const pinValue = (pinInput?.value || '').trim();
            const constraints = {
                pin: {
                    presence: { allowEmpty: false, message: '^Ingrese su PIN para continuar.' },
                    format: { pattern: '^[0-9]{4}$', message: '^El PIN debe contener 4 dígitos numéricos.' }
                }
            };
            const errors = typeof validate === 'function' ? validate({ pin: pinValue }, constraints) : null;

            if (errors && errors.pin) {
                showMessage(loginErrorBox, flattenErrors(errors), 'error');
                return;
            }

            if (pinValue !== userData.pin) {
                showMessage(loginErrorBox, 'PIN incorrecto. Intente nuevamente.', 'error');
                if (pinInput) {
                    pinInput.focus();
                }
                return;
            }

            if (pinInput) {
                pinInput.value = '';
            }

            hideElement(loginSection);
            showElement(atmSection);
            updateUserSummary();
            updateBalanceDisplays();
            renderTransactions();
            updateChart();
            const previousTransactions = userData.transactions || [];
            setLastTransaction(previousTransactions.length ? previousTransactions[previousTransactions.length - 1] : null);
        });
    }

    optionButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const target = button.getAttribute('data-transaction');
            showTransactionSection(target);
        });
    });

    resetButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const target = button.getAttribute('data-reset');
            const section = document.querySelector(`[data-transaction-section="${target}"]`);
            if (section) {
                section.classList.add('d-none');
            }

            switch (target) {
                case 'deposit':
                    depositForm?.reset();
                    hideMessage(depositErrorBox);
                    hideMessage(depositSuccessBox);
                    break;
                case 'withdraw':
                    withdrawForm?.reset();
                    hideMessage(withdrawErrorBox);
                    hideMessage(withdrawSuccessBox);
                    break;
                case 'payment':
                    paymentForm?.reset();
                    hideMessage(paymentErrorBox);
                    hideMessage(paymentSuccessBox);
                    break;
                case 'balance':
                    hideMessage(balanceSuccessBox);
                    break;
                default:
                    break;
            }
        });
    });

    if (depositForm) {
        depositForm.addEventListener('submit', (event) => {
            event.preventDefault();
            hideMessage(depositErrorBox);
            hideMessage(depositSuccessBox);

            const attributes = {
                amount: (depositAmountInput?.value || '').trim(),
                description: (depositDescriptionInput?.value || '').trim()
            };

            const constraints = {
                amount: {
                    presence: { allowEmpty: false, message: '^Ingrese el monto a depositar.' },
                    numericality: {
                        greaterThan: 0,
                        message: '^El monto debe ser mayor que $0.00.'
                    }
                },
                description: {
                    length: {
                        maximum: 80,
                        message: '^La descripción debe contener máximo 80 caracteres.'
                    }
                }
            };

            const errors = typeof validate === 'function' ? validate(attributes, constraints) : null;
            if (errors && Object.keys(errors).length) {
                showMessage(depositErrorBox, flattenErrors(errors), 'error');
                return;
            }

            const amount = parseAmount(attributes.amount);
            if (!Number.isFinite(amount) || amount <= 0) {
                showMessage(depositErrorBox, 'Ingrese un monto válido mayor a 0.', 'error');
                return;
            }

            userData.balance = roundToTwo(userData.balance + amount);
            const transaction = {
                id: Date.now(),
                type: 'Depósito',
                amount,
                description: attributes.description || 'Depósito en cuenta',
                date: new Date().toISOString(),
                balanceAfter: userData.balance
            };
            userData.transactions.push(transaction);

            showMessage(
                depositSuccessBox,
                `Depósito realizado correctamente. Nuevo saldo: ${formatCurrency(userData.balance)}.`,
                'success'
            );
            depositForm.reset();
            updateAfterTransaction(transaction);
        });
    }

    if (withdrawForm) {
        withdrawForm.addEventListener('submit', (event) => {
            event.preventDefault();
            hideMessage(withdrawErrorBox);
            hideMessage(withdrawSuccessBox);

            const attributes = {
                amount: (withdrawAmountInput?.value || '').trim(),
                description: (withdrawDescriptionInput?.value || '').trim()
            };

            const constraints = {
                amount: {
                    presence: { allowEmpty: false, message: '^Ingrese el monto a retirar.' },
                    numericality: {
                        greaterThan: 0,
                        message: '^El monto debe ser mayor que $0.00.'
                    }
                },
                description: {
                    length: {
                        maximum: 80,
                        message: '^La descripción debe contener máximo 80 caracteres.'
                    }
                }
            };

            const errors = typeof validate === 'function' ? validate(attributes, constraints) : null;
            if (errors && Object.keys(errors).length) {
                showMessage(withdrawErrorBox, flattenErrors(errors), 'error');
                return;
            }

            const amount = parseAmount(attributes.amount);
            if (!Number.isFinite(amount) || amount <= 0) {
                showMessage(withdrawErrorBox, 'Ingrese un monto válido mayor a 0.', 'error');
                return;
            }

            if (amount > userData.balance) {
                showMessage(withdrawErrorBox, 'El monto excede su saldo disponible.', 'error');
                return;
            }

            userData.balance = roundToTwo(userData.balance - amount);
            const transaction = {
                id: Date.now(),
                type: 'Retiro',
                amount,
                description: attributes.description || 'Retiro de efectivo',
                date: new Date().toISOString(),
                balanceAfter: userData.balance
            };
            userData.transactions.push(transaction);

            showMessage(
                withdrawSuccessBox,
                `Retiro realizado correctamente. Nuevo saldo: ${formatCurrency(userData.balance)}.`,
                'success'
            );
            withdrawForm.reset();
            updateAfterTransaction(transaction);
        });
    }

    if (paymentForm) {
        paymentForm.addEventListener('submit', (event) => {
            event.preventDefault();
            hideMessage(paymentErrorBox);
            hideMessage(paymentSuccessBox);

            const attributes = {
                service: (paymentServiceInput?.value || '').trim(),
                reference: (paymentReferenceInput?.value || '').trim(),
                amount: (paymentAmountInput?.value || '').trim()
            };

            const constraints = {
                service: {
                    presence: { allowEmpty: false, message: '^Ingrese el nombre del servicio.' },
                    length: {
                        maximum: 50,
                        message: '^El servicio debe tener máximo 50 caracteres.'
                    }
                },
                reference: {
                    presence: { allowEmpty: false, message: '^Ingrese la referencia del pago.' },
                    format: {
                        pattern: '^[0-9A-Za-z-]{4,20}$',
                        message: '^La referencia debe tener entre 4 y 20 caracteres alfanuméricos.'
                    }
                },
                amount: {
                    presence: { allowEmpty: false, message: '^Ingrese el monto a pagar.' },
                    numericality: {
                        greaterThan: 0,
                        message: '^El monto debe ser mayor que $0.00.'
                    }
                }
            };

            const errors = typeof validate === 'function' ? validate(attributes, constraints) : null;
            if (errors && Object.keys(errors).length) {
                showMessage(paymentErrorBox, flattenErrors(errors), 'error');
                return;
            }

            const amount = parseAmount(attributes.amount);
            if (!Number.isFinite(amount) || amount <= 0) {
                showMessage(paymentErrorBox, 'Ingrese un monto válido mayor a 0.', 'error');
                return;
            }

            if (amount > userData.balance) {
                showMessage(paymentErrorBox, 'El monto excede su saldo disponible.', 'error');
                return;
            }

            userData.balance = roundToTwo(userData.balance - amount);
            const transaction = {
                id: Date.now(),
                type: 'Pago de servicio',
                amount,
                service: attributes.service,
                reference: attributes.reference,
                description: `Pago aplicado a ${attributes.service}`,
                date: new Date().toISOString(),
                balanceAfter: userData.balance
            };
            userData.transactions.push(transaction);

            showMessage(
                paymentSuccessBox,
                `Pago registrado correctamente. Nuevo saldo: ${formatCurrency(userData.balance)}.`,
                'success'
            );
            paymentForm.reset();
            updateAfterTransaction(transaction);
        });
    }

    if (balanceInquiryButton) {
        balanceInquiryButton.addEventListener('click', () => {
            hideMessage(balanceSuccessBox);
            const transaction = {
                id: Date.now(),
                type: 'Consulta de saldo',
                amount: 0,
                description: 'Consulta de saldo registrada en cajero web',
                date: new Date().toISOString(),
                balanceAfter: userData.balance
            };
            userData.transactions.push(transaction);

            showMessage(
                balanceSuccessBox,
                `Consulta registrada. Su saldo disponible es ${formatCurrency(userData.balance)}.`,
                'success'
            );
            updateAfterTransaction(transaction);
        });
    }

    if (printReceiptButton) {
        printReceiptButton.addEventListener('click', () => {
            if (!lastTransaction) {
                return;
            }
            generateReceiptPDF(lastTransaction);
        });
    }

    if (exitButton) {
        exitButton.addEventListener('click', logout);
    }

    // Focus PIN input on load
    if (pinInput) {
        pinInput.focus();
    }
});

