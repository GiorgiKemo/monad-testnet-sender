document.addEventListener('DOMContentLoaded', function() {
    const connectButton = document.getElementById('connectWalletBtn');
    const disconnectButton = document.getElementById('disconnectWalletBtn');
    const walletDropdown = document.getElementById('walletDropdown');
    const walletModal = document.getElementById('walletModal');
    const closeModalButton = document.getElementById('closeWalletModal');
    const walletOptions = document.querySelectorAll('.wallet-option');
    const sendButton = document.getElementById('sendButton');
    const txHistory = document.getElementById('txHistory');
    const networkPrompt = document.getElementById('networkPrompt');
    const switchNetworkButton = document.getElementById('switchNetworkButton');
    const txCounterElement = document.getElementById('txCounter');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const errorDisplay = document.getElementById('errorDisplay');
    const walletContainer = document.querySelector('.wallet-container');

    let txCount = 0;

    const MONAD_TESTNET_CHAIN_ID = 10143;
    const MONAD_TESTNET = {
        chainId: '0x279F',
        chainName: 'Monad Testnet',
        nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
        rpcUrls: ['https://testnet-rpc.monad.xyz'],
        blockExplorerUrls: ['https://monad-testnet.socialscan.io']
    };

    // Initialize dark mode from localStorage
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        darkModeToggle.checked = true;
    }

    function showError(message) {
        if (!message) {
            errorDisplay.innerHTML = '';
            return;
        }
        
        errorDisplay.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <span>${message}</span>
            </div>
        `;
        setTimeout(() => {
            errorDisplay.innerHTML = '';
        }, 5000);
    }

    function openModal() {
        walletModal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        walletModal.classList.remove('show');
        document.body.style.overflow = '';
    }

    function closeNetworkPrompt() {
        networkPrompt.classList.remove('show');
        document.body.style.overflow = '';
    }

    function updateButton(address) {
        connectButton.innerHTML = `
            <i class="fas fa-wallet"></i>
            <span>${address.slice(0, 6)}...${address.slice(-4)}</span>
        `;
        walletContainer.classList.add('connected');
        localStorage.setItem('connectedWallet', address);
        console.log("Button updated with address:", address);
    }

    function disconnectWallet() {
        connectButton.innerHTML = '<i class="fas fa-wallet"></i><span>Connect Wallet</span>';
        walletContainer.classList.remove('connected');
        localStorage.removeItem('connectedWallet');
        if (window.ethereum) {
            window.ethereum.removeAllListeners('accountsChanged');
        }
    }

    async function connectMetaMask() {
        if (!window.ethereum) {
            showError("Please install MetaMask to connect.");
            return;
        }
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (accounts.length > 0) {
                updateButton(accounts[0]);
                closeModal();
            }
        } catch (error) {
            showError(error.code === 4001 ? "Connection rejected by user." : `Connection failed: ${error.message}`);
            console.error("MetaMask connection error:", error);
        }
    }

    async function checkConnection() {
        if (!window.ethereum) return;
        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const accounts = await provider.listAccounts();
            if (accounts.length > 0) {
                updateButton(accounts[0]);
                console.log("Restored connection on load:", accounts[0]);
            }
        } catch (error) {
            console.error("Error checking connection:", error);
        }
    }

    if (window.ethereum) {
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length > 0) {
                updateButton(accounts[0]);
            } else {
                connectButton.innerHTML = '<i class="fas fa-wallet"></i><span>Connect Wallet</span>';
                walletContainer.classList.remove('connected');
                localStorage.removeItem('connectedWallet');
            }
        });
    }

    checkConnection();

    // Event Listeners
    connectButton.addEventListener('click', openModal);
    closeModalButton.addEventListener('click', closeModal);
    disconnectButton.addEventListener('click', disconnectWallet);

    // Only keep MetaMask option
    walletOptions.forEach(option => {
        if (option.getAttribute('data-wallet') === 'metamask') {
            option.addEventListener('click', connectMetaMask);
        }
    });

    darkModeToggle.addEventListener('change', function() {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', this.checked);
    });

    sendButton.addEventListener('click', async () => {
        if (!connectButton.textContent.includes("...")) {
            showError("Please connect your wallet first.");
            return;
        }

        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const network = await provider.getNetwork();
            if (network.chainId !== MONAD_TESTNET_CHAIN_ID) {
                networkPrompt.classList.add('show');
                document.body.style.overflow = 'hidden';
            } else {
                closeNetworkPrompt();
                await sendTransaction();
            }
        } catch (error) {
            console.error("Error checking network:", error);
            showError("An error occurred while checking the network.");
        }
    });

    switchNetworkButton.addEventListener('click', async () => {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: MONAD_TESTNET.chainId }],
            });
            console.log("Switched to Monad Testnet.");
            closeNetworkPrompt();
            await sendTransaction();
        } catch (switchError) {
            if (switchError.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [MONAD_TESTNET],
                });
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: MONAD_TESTNET.chainId }],
                });
                console.log("Monad Testnet added and switched.");
                closeNetworkPrompt();
                await sendTransaction();
            } else {
                console.error("Failed to switch network:", switchError);
                showError("Failed to switch network: " + switchError.message);
            }
        }
    });

    async function sendTransaction() {
        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const balance = await provider.getBalance(await signer.getAddress());
            const minAmount = ethers.utils.parseEther("0.00001");
            const maxAmount = ethers.utils.parseEther("0.0002");
            const randomAmount = ethers.utils.parseEther(
                (Math.random() * (0.0002 - 0.00001) + 0.00001).toFixed(5)
            );

            if (balance.lt(randomAmount)) {
                showError("Insufficient balance for transaction");
                return;
            }

            const randomAddress = ethers.Wallet.createRandom().address;
            const tx = await signer.sendTransaction({
                to: randomAddress,
                value: randomAmount
            });

            txCount++;
            txCounterElement.textContent = txCount;

            const txElement = document.createElement('div');
            txElement.className = 'tx-entry';
            txElement.innerHTML = `
                <div class="tx-details">
                    <span class="tx-amount">${ethers.utils.formatEther(randomAmount)} MON</span>
                    <a href="https://monad-testnet.socialscan.io/tx/${tx.hash}" target="_blank" class="tx-link">
                        View Transaction
                    </a>
                </div>
            `;
            txHistory.insertBefore(txElement, txHistory.firstChild);

            console.log("Transaction sent:", tx.hash);
        } catch (error) {
            console.error("Transaction error:", error);
            showError("Transaction failed: " + error.message);
        }
    }

    // Removed JavaScript hover listeners; handled by CSS now

    // Add click event listeners to close modals on outside click
    networkPrompt.addEventListener('click', function(event) {
        if (event.target === networkPrompt) {
            closeNetworkPrompt();
        }
    });

    walletModal.addEventListener('click', function(event) {
        if (event.target === walletModal) {
            closeModal();
        }
    });
});