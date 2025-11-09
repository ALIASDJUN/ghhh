// ========== VARIABLES GLOBALES ==========
let currentBalance = 400000000.00;
let transactions = [];
let isInitialized = false;

// ========== FONCTIONS DE PERSISTANCE (AVEC DOUBLE SAUVEGARDE) ==========
async function saveData() {
    try {
        const data = {
            balance: parseFloat(currentBalance),
            transactions: transactions,
            lastUpdate: new Date().toISOString()
        };
        
        const dataString = JSON.stringify(data);
        
        // Sauvegarde avec window.storage (API Claude)
        let storageSuccess = false;
        if (window.storage && window.storage.set) {
            try {
                const result = await window.storage.set('khan-bank-data', dataString);
                storageSuccess = !!result;
            } catch (e) {
                console.warn('⚠️ window.storage non disponible:', e.message);
            }
        }
        
        // Sauvegarde de secours avec localStorage
        let localStorageSuccess = false;
        try {
            localStorage.setItem('khan-bank-data', dataString);
            localStorageSuccess = true;
        } catch (e) {
            console.warn('⚠️ localStorage non disponible:', e.message);
        }
        
        if (storageSuccess || localStorageSuccess) {
            console.log('✅ Sauvegarde réussie - Solde:', formatCurrency(currentBalance), '- Transactions:', transactions.length);
            if (storageSuccess) console.log('   → window.storage: ✅');
            if (localStorageSuccess) console.log('   → localStorage: ✅');
            return true;
        } else {
            console.error('❌ Échec de toutes les sauvegardes');
            return false;
        }
    } catch (error) {
        console.error('❌ Erreur lors de la sauvegarde:', error);
        return false;
    }
}

async function loadData() {
    try {
        let data = null;
        
        // Essayer de charger depuis window.storage d'abord
        if (window.storage && window.storage.get) {
            try {
                const result = await window.storage.get('khan-bank-data');
                if (result && result.value) {
                    data = JSON.parse(result.value);
                    console.log('📥 Données chargées depuis window.storage');
                }
            } catch (e) {
                console.warn('⚠️ Impossible de charger depuis window.storage:', e.message);
            }
        }
        
        // Si pas de données, essayer localStorage
        if (!data) {
            try {
                const localData = localStorage.getItem('khan-bank-data');
                if (localData) {
                    data = JSON.parse(localData);
                    console.log('📥 Données chargées depuis localStorage');
                }
            } catch (e) {
                console.warn('⚠️ Impossible de charger depuis localStorage:', e.message);
            }
        }
        
        // Si des données ont été trouvées
        if (data) {
            // S'assurer que les données sont valides
            if (data.balance !== undefined && data.balance !== null) {
                currentBalance = parseFloat(data.balance);
            }
            
            if (Array.isArray(data.transactions)) {
                transactions = data.transactions;
            }
            
            console.log('✅ Données restaurées - Solde:', formatCurrency(currentBalance), '- Transactions:', transactions.length);
            if (data.lastUpdate) {
                console.log('   📅 Dernière mise à jour:', data.lastUpdate);
            }
            return true;
        } else {
            console.log('ℹ️ Aucune donnée sauvegardée trouvée');
            return false;
        }
    } catch (error) {
        console.log('ℹ️ Première utilisation ou erreur de chargement:', error.message);
        return false;
    }
}

// ========== FONCTIONS D'AFFICHAGE ==========
function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    
    pages.forEach(page => {
        page.classList.remove('active');
    });
    
    const selectedPage = document.getElementById(pageId);
    if (selectedPage) {
        selectedPage.classList.add('active');
    }
    
    // Mettre à jour les affichages selon la page
    if (pageId === 'home') {
        updateHomeBalance();
        loadTransactionHistory();
    } else if (pageId === 'transfer') {
        updateTransferBalance();
    } else if (pageId === 'success') {
        updateSuccessDateTime();
    }
}

function updateHomeBalance() {
    const balanceAmount = document.querySelector('.balance-amount');
    if (balanceAmount) {
        const formattedBalance = formatNumber(currentBalance);
        balanceAmount.textContent = formattedBalance;
        balanceAmount.setAttribute('data-balance', formattedBalance);
        console.log('🔄 Solde mis à jour sur page d\'accueil:', formattedBalance);
    }
}

function updateTransferBalance() {
    const transferBalance = document.querySelector('.transfer-balance-right');
    if (transferBalance) {
        transferBalance.textContent = formatNumber(currentBalance) + ' ₮';
    }
}

// ========== FONCTIONS DE FORMATAGE ==========
function formatNumber(number) {
    return number.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatCurrency(amount) {
    return formatNumber(amount) + ' MNT';
}

function getMongoliaTime() {
    const now = new Date();
    return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ulaanbaatar' }));
}

function formatMongoliaDateTime() {
    const mongoliaTime = getMongoliaTime();
    const year = mongoliaTime.getFullYear();
    const month = String(mongoliaTime.getMonth() + 1).padStart(2, '0');
    const day = String(mongoliaTime.getDate()).padStart(2, '0');
    const hours = String(mongoliaTime.getHours()).padStart(2, '0');
    const minutes = String(mongoliaTime.getMinutes()).padStart(2, '0');
    
    return {
        fullDate: `${year}/${month}/${day} ${hours}:${minutes}`,
        date: `${year}.${month}.${day}`,
        time: `${hours}:${minutes}`
    };
}

// ========== GESTION DES TRANSACTIONS ==========
async function addTransaction(amount, recipientName, recipientAccount, description) {
    const mongoliaTime = formatMongoliaDateTime();
    
    const transaction = {
        id: Date.now(),
        date: mongoliaTime.date,
        time: mongoliaTime.time,
        amount: amount,
        recipientName: recipientName,
        recipientAccount: recipientAccount,
        description: description || 'No description',
        remainingBalance: currentBalance,
        timestamp: mongoliaTime.fullDate
    };
    
    transactions.unshift(transaction);
    
    // Sauvegarder immédiatement
    await saveData();
    
    loadTransactionHistory();
}

function loadTransactionHistory() {
    const transactionsContainer = document.querySelector('.transactions');
    if (!transactionsContainer) return;
    
    // Supprimer les transactions existantes (sauf le header)
    const existingItems = transactionsContainer.querySelectorAll('.transaction-date, .transaction-item');
    existingItems.forEach(item => item.remove());
    
    if (transactions.length === 0) {
        return;
    }
    
    // Grouper les transactions par date
    const groupedTransactions = {};
    transactions.forEach(transaction => {
        if (!groupedTransactions[transaction.date]) {
            groupedTransactions[transaction.date] = [];
        }
        groupedTransactions[transaction.date].push(transaction);
    });
    
    // Afficher les transactions groupées par date
    Object.keys(groupedTransactions).forEach(date => {
        const dateElement = document.createElement('div');
        dateElement.className = 'transaction-date';
        dateElement.textContent = date;
        transactionsContainer.appendChild(dateElement);
        
        groupedTransactions[date].forEach(transaction => {
            const transactionItem = document.createElement('div');
            transactionItem.className = 'transaction-item';
            
            transactionItem.innerHTML = `
                <div class="transaction-icon">
                    <i class="fas fa-arrow-up"></i>
                </div>
                <div class="transaction-details">
                    <div class="transaction-time">${transaction.time}</div>
                    <div class="transaction-description">${transaction.description}</div>
                    <div class="transaction-remainder">Rem: ${formatCurrency(transaction.remainingBalance)}</div>
                </div>
                <div class="transaction-amount">-${formatCurrency(transaction.amount)}</div>
                <i class="fas fa-chevron-right arrow-right"></i>
            `;
            
            transactionsContainer.appendChild(transactionItem);
        });
    });
}

function updateSuccessDateTime() {
    const successDate = document.querySelector('.success-date');
    if (successDate) {
        const mongoliaTime = formatMongoliaDateTime();
        successDate.textContent = mongoliaTime.fullDate;
    }
}

// ========== TRAITEMENT DU TRANSFERT ==========
async function processTransfer() {
    const amountInput = document.querySelector('.amount-input');
    const recipientNameInput = document.getElementById('recipientNameInput');
    const recipientAccountInput = document.getElementById('recipientAccountInput');
    const descriptionInput = document.getElementById('descriptionInput');
    
    // Validation des éléments
    if (!amountInput || !recipientNameInput || !recipientAccountInput || !descriptionInput) {
        console.error('❌ Éléments du formulaire manquants');
        alert('Erreur: Formulaire incomplet');
        return false;
    }
    
    // Récupérer et valider le montant
    const amountStr = amountInput.value.replace(/,/g, '').trim();
    const amount = parseFloat(amountStr);
    
    if (isNaN(amount) || amount <= 0) {
        alert('Veuillez entrer un montant valide');
        return false;
    }
    
    // Validation des champs
    const recipientName = recipientNameInput.value.trim();
    const recipientAccount = recipientAccountInput.value.trim();
    
    if (!recipientName) {
        alert('Veuillez entrer le nom du bénéficiaire');
        recipientNameInput.focus();
        return false;
    }
    
    if (!recipientAccount) {
        alert('Veuillez entrer le numéro de compte du bénéficiaire');
        recipientAccountInput.focus();
        return false;
    }
    
    // Vérifier le solde suffisant
    if (amount > currentBalance) {
        alert('Solde insuffisant!\nMontant demandé: ' + formatCurrency(amount) + '\nSolde disponible: ' + formatCurrency(currentBalance));
        return false;
    }
    
    // Calculer le nouveau solde
    const remainingBalance = currentBalance - amount;
    
    // DÉBITER LE SOLDE
    currentBalance = remainingBalance;
    
    // Ajouter la transaction à l'historique
    await addTransaction(
        amount,
        recipientName.toUpperCase(),
        recipientAccount,
        descriptionInput.value.trim() || 'Transaction'
    );
    
    // Mettre à jour la page de succès
    const successAmount = document.getElementById('displayAmount');
    if (successAmount) {
        successAmount.textContent = formatCurrency(amount);
    }
    
    const recipientNameDisplay = document.getElementById('recipientName');
    if (recipientNameDisplay) {
        recipientNameDisplay.textContent = recipientName.toUpperCase();
    }
    
    const recipientAccountDisplay = document.getElementById('recipientAccount');
    if (recipientAccountDisplay) {
        recipientAccountDisplay.textContent = recipientAccount;
    }
    
    const transactionDescription = document.getElementById('transactionDescription');
    if (transactionDescription) {
        transactionDescription.textContent = descriptionInput.value.trim() || 'No description';
    }
    
    // Mettre à jour le solde restant sur la page de succès (masqué par défaut)
    const remainingBalanceElement = document.getElementById('remainingBalance');
    if (remainingBalanceElement) {
        remainingBalanceElement.textContent = '*****';
        remainingBalanceElement.setAttribute('data-balance', formatCurrency(remainingBalance));
    }
    
    // Mettre à jour les soldes sur toutes les pages
    updateHomeBalance();
    updateTransferBalance();
    
    // Réinitialiser le formulaire
    amountInput.value = '0.00';
    recipientNameInput.value = '';
    recipientAccountInput.value = '';
    descriptionInput.value = '';
    
    // Désactiver les tags actifs
    document.querySelectorAll('.tag.active').forEach(tag => {
        tag.classList.remove('active');
    });
    
    // Afficher la page de succès
    showPage('success');
    
    console.log('✅ Transaction effectuée avec succès!');
    console.log('💰 Nouveau solde:', formatCurrency(currentBalance));
    console.log('📋 Nombre total de transactions:', transactions.length);
    
    return true;
}

// ========== INITIALISATION ==========
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Initialisation de l\'application Khan Bank...');
    
    // Charger les données sauvegardées en premier et attendre
    const dataLoaded = await loadData();
    
    if (dataLoaded) {
        console.log('📊 Données restaurées depuis le stockage');
    } else {
        console.log('🆕 Utilisation des valeurs par défaut');
        // Sauvegarder les valeurs par défaut
        await saveData();
    }
    
    // Afficher la page d'accueil par défaut avec les données chargées
    showPage('home');
    
    // ========== GESTION DE L'INPUT MONTANT ==========
    const amountInput = document.querySelector('.amount-input');
    if (amountInput) {
        amountInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/[^0-9.]/g, '');
            
            // Autoriser un seul point décimal
            const parts = value.split('.');
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            
            // Limiter à 2 décimales
            if (parts[1] && parts[1].length > 2) {
                value = parts[0] + '.' + parts[1].substring(0, 2);
            }
            
            e.target.value = value;
        });
        
        amountInput.addEventListener('focus', function(e) {
            if (e.target.value === '0.00' || e.target.value === '0') {
                e.target.value = '';
            }
        });
        
        amountInput.addEventListener('blur', function(e) {
            const value = e.target.value.trim();
            if (value === '' || value === '0' || parseFloat(value) === 0) {
                e.target.value = '0.00';
            } else {
                const num = parseFloat(value);
                if (!isNaN(num)) {
                    e.target.value = num.toFixed(2);
                }
            }
        });
    }
    
    // ========== COPIER LE NUMÉRO DE COMPTE ==========
    const copyIcon = document.querySelector('.copy-icon');
    if (copyIcon) {
        copyIcon.addEventListener('click', function() {
            const accountNumber = 'MN14 0005 00 5684015842';
            
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(accountNumber).then(() => {
                    alert('Numéro de compte copié: ' + accountNumber);
                }).catch(() => {
                    fallbackCopy(accountNumber);
                });
            } else {
                fallbackCopy(accountNumber);
            }
        });
    }
    
    function fallbackCopy(text) {
        const tempInput = document.createElement('input');
        tempInput.value = text;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        alert('Numéro de compte copié: ' + text);
    }
    
    // ========== GESTION DES TAGS ==========
    const tags = document.querySelectorAll('.tag');
    tags.forEach(tag => {
        tag.addEventListener('click', function() {
            this.classList.toggle('active');
            
            // Ne pas ajouter le texte des tags avec le symbole +
            if (!this.querySelector('.fa-plus')) {
                const descriptionInput = document.getElementById('descriptionInput');
                if (descriptionInput) {
                    const currentValue = descriptionInput.value.trim();
                    const tagText = this.textContent.trim();
                    
                    if (currentValue) {
                        descriptionInput.value = currentValue + ' ' + tagText;
                    } else {
                        descriptionInput.value = tagText;
                    }
                }
            }
        });
    });
    
    // ========== BOUTON CONTINUER ==========
    const continueBtn = document.querySelector('.continue-btn');
    if (continueBtn) {
        continueBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            console.log('🔄 Traitement du transfert...');
            
            // Désactiver le bouton pendant le traitement
            this.disabled = true;
            const originalText = this.textContent;
            this.textContent = 'Traitement...';
            
            await processTransfer();
            
            // Réactiver le bouton
            this.disabled = false;
            this.textContent = originalText;
        });
    }
    
    // ========== TOGGLE VISIBILITÉ DU SOLDE ==========
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('eye-icon') || e.target.classList.contains('fa-eye') || e.target.classList.contains('fa-eye-slash')) {
            const eyeIcon = e.target.classList.contains('eye-icon') ? e.target : e.target.parentElement;
            const balanceElement = eyeIcon.previousElementSibling || eyeIcon.closest('.info-value-right')?.querySelector('span');
            
            if (balanceElement) {
                if (eyeIcon.classList.contains('fa-eye-slash') || eyeIcon.querySelector('.fa-eye-slash')) {
                    // Afficher le solde
                    const actualBalance = balanceElement.getAttribute('data-balance');
                    if (actualBalance) {
                        balanceElement.textContent = actualBalance;
                    }
                    eyeIcon.classList.remove('fa-eye-slash');
                    eyeIcon.classList.add('fa-eye');
                } else {
                    // Masquer le solde
                    balanceElement.textContent = '*****';
                    eyeIcon.classList.remove('fa-eye');
                    eyeIcon.classList.add('fa-eye-slash');
                }
            }
        }
    });
    
    // ========== AUTRES BOUTONS ==========
    const digiPayBtn = document.querySelector('.digi-pay-btn');
    if (digiPayBtn) {
        digiPayBtn.addEventListener('click', function() {
            alert('Fonctionnalité DiGi Pay bientôt disponible!');
        });
    }
    
    const statementBtn = document.querySelector('.action-btn:first-child');
    if (statementBtn) {
        statementBtn.addEventListener('click', function() {
            alert('Fonctionnalité Statement bientôt disponible!');
        });
    }
    
    const financesBtn = document.querySelector('.action-btn:last-child');
    if (financesBtn) {
        financesBtn.addEventListener('click', function() {
            alert('Fonctionnalité My Finances bientôt disponible!');
        });
    }
    
    const notificationBtn = document.querySelector('.header-right .icon-btn:first-child');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', function() {
            alert('Aucune nouvelle notification');
        });
    }
    
    isInitialized = true;
    console.log('✅ Application Khan Bank initialisée avec succès!');
    console.log('💰 Solde actuel:', formatCurrency(currentBalance));
    console.log('📋 Nombre de transactions:', transactions.length);
});