document.addEventListener('DOMContentLoaded', function() {
    const connectButton = document.querySelector('.nav-button');
    const walletModal = document.querySelector('.wallet-modal');
    const closeModalButton = document.querySelector('.close-modal');
    const walletOptions = document.querySelectorAll('.wallet-option');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    const disconnectButton = document.querySelector('.disconnect-button');
    const sendButton = document.querySelector('.action-button');
    const txHistoryContainer = document.querySelector('.tx-history');
    const networkPrompt = document.getElementById('networkPrompt');
    const switchNetworkButton = document.getElementById('switchNetworkButton');
    const txCounterElement = document.getElementById('txCounter');
    const darkModeToggle = document.getElementById('darkModeToggle');

    let txCount = 0;

    const MONAD_TESTNET_CHAIN_ID = 10143;
    const MONAD_TESTNET = {
        chainId: '0x279F',
        chainName: 'Monad Testnet',
        nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
        rpcUrls: ['https://testnet-rpc.monad.xyz'],
        blockExplorerUrls: ['https://monad-testnet.socialscan.io']
    };

    function showError(message) {
        document.getElementById('error-display').textContent = message;
    }

    function openModal() {
        walletModal.style.display = 'flex';
    }

    function toggleDropdown() {
        dropdownMenu.style.display = dropdownMenu.style.display === 'none' ? 'block' : 'none';
    }

    function disconnectWallet() {
        connectButton.textContent = 'Connect Wallet';
        dropdownMenu.style.display = 'none';
        connectButton.removeEventListener('click', toggleDropdown);
        connectButton.addEventListener('click', openModal);
        console.log("Wallet disconnected.");
    }

    connectButton.addEventListener('click', openModal);
    disconnectButton.addEventListener('click', disconnectWallet);

    document.addEventListener('click', function(event) {
        if (!event.target.closest('.wallet-container')) {
            dropdownMenu.style.display = 'none';
        }
    });

    function updateButton(address) {
        connectButton.textContent = `Connected: ${address.slice(0, 6)}...${address.slice(-4)}`;
        connectButton.removeEventListener('click', openModal);
        connectButton.addEventListener('click', toggleDropdown);
        console.log("Button updated with address:", address);
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
                disconnectWallet();
            }
        });
        window.ethereum.on('disconnect', disconnectWallet);
    }

    checkConnection();

    closeModalButton.addEventListener('click', function() {
        walletModal.style.display = 'none';
    });

    walletOptions.forEach(option => {
        option.addEventListener('click', async () => {
            const walletType = option.getAttribute('data-wallet');
            if (walletType === 'metamask') {
                await connectMetaMask();
            } else if (walletType === 'walletconnect') {
                showError('WalletConnect not implemented yet. Use MetaMask.');
            }
            walletModal.style.display = 'none';
        });
    });

    darkModeToggle.addEventListener('change', function() {
        document.body.classList.toggle('dark-mode');
    });

    sendButton.addEventListener('click', async () => {
        if (!connectButton.textContent.startsWith("Connected:")) {
            showError("Please connect your wallet first.");
            return;
        }

        try {
            showError(''); // Clear previous error before attempting new transaction
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const network = await provider.getNetwork();
            if (network.chainId !== MONAD_TESTNET_CHAIN_ID) {
                networkPrompt.classList.add('show');
            } else {
                networkPrompt.classList.remove('show');
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
            networkPrompt.classList.remove('show');
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
                networkPrompt.classList.remove('show');
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
            const minAmount = 0.00001;
            const maxAmount = 0.0002;
            const randomAmount = minAmount + Math.random() * (maxAmount - minAmount);
            const amount = ethers.utils.parseEther(randomAmount.toFixed(18));
            if (balance.lt(amount)) {
                showError('Insufficient balance for this transaction.');
                return;
            }
            const randomWallet = ethers.Wallet.createRandom();
            const recipient = randomWallet.address;
            const tx = await signer.sendTransaction({
                to: recipient,
                value: amount
            });
            console.log(`Transaction sent: ${ethers.utils.formatEther(amount)} MON`, tx.hash);
            await tx.wait();
            console.log("Transaction confirmed.");

            const txEntry = document.createElement('li');
            txEntry.innerHTML = `Sent ${ethers.utils.formatEther(amount)} MON: <a href="https://monad-testnet.socialscan.io/tx/${tx.hash}" target="_blank">${tx.hash}</a>`;
            txHistoryContainer.appendChild(txEntry);

            txCount++;
            txCounterElement.textContent = `Total Transactions: ${txCount}`;
        } catch (error) {
            console.error("Transaction error:", error);
            showError("Transaction failed: " + error.message);
        }
    }
});