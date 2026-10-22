(function () {
    const ACCOUNTS_KEY = "petShopLocalAccounts";
    const SESSION_KEY = "petShopLocalSession";
    const ITERATIONS = 120000;
    const encoder = new TextEncoder();

    function getAccounts() {
        const saved = localStorage.getItem(ACCOUNTS_KEY);
        if (saved === null) {
            return [];
        }

        const accounts = JSON.parse(saved);
        if (!Array.isArray(accounts)) {
            throw new Error("Saved account data is invalid. Clear the petShopLocalAccounts browser-storage entry to start over.");
        }
        return accounts;
    }

    function bytesToHex(bytes) {
        return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    async function hashPassword(password, salt) {
        const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
        const bits = await crypto.subtle.deriveBits({
            name: "PBKDF2",
            salt: Uint8Array.from(salt.match(/.{2}/g), (byte) => parseInt(byte, 16)),
            iterations: ITERATIONS,
            hash: "SHA-256"
        }, key, 256);
        return bytesToHex(bits);
    }

    function showLoginError(message) {
        const messageElement = document.getElementById("loginMessage");
        if (messageElement) {
            messageElement.textContent = message;
        } else {
            window.alert(message);
        }
    }

    async function initializeLoginPage() {
        const form = document.getElementById("loginForm");
        if (!form) {
            return;
        }

        const emailInput = document.getElementById("loginEmail");
        const passwordInput = document.getElementById("loginPassword");
        const submitButton = document.getElementById("loginButton");
        const modeButton = document.getElementById("modeButton");
        const subtitle = document.getElementById("loginSubtitle");
        const passwordHelp = document.getElementById("passwordHelp");
        let creatingAccount = false;

        try {
            if (localStorage.getItem(SESSION_KEY)) {
                window.location.replace("index.html");
                return;
            }
        } catch (error) {
            showLoginError(error instanceof Error ? error.message : "Could not read local account data.");
            return;
        }

        modeButton.addEventListener("click", () => {
            creatingAccount = !creatingAccount;
            subtitle.textContent = creatingAccount ? "Create an employee account" : "Employee sign in";
            submitButton.textContent = creatingAccount ? "Create account" : "Sign in";
            modeButton.textContent = creatingAccount ? "Back to sign in" : "Create an account";
            passwordHelp.hidden = !creatingAccount;
            passwordInput.autocomplete = creatingAccount ? "new-password" : "current-password";
            passwordInput.minLength = creatingAccount ? 8 : 1;
            document.getElementById("loginMessage").textContent = "";
        });

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            document.getElementById("loginMessage").textContent = "";
            submitButton.disabled = true;
            submitButton.textContent = creatingAccount ? "Creating..." : "Signing in...";

            try {
                const email = emailInput.value.trim().toLowerCase();
                const password = passwordInput.value;
                const accounts = getAccounts();
                let account;

                if (creatingAccount) {
                    if (password.length < 8) {
                        throw new Error("Choose a password with at least 8 characters.");
                    }
                    if (accounts.some((item) => item.email === email)) {
                        throw new Error("An account with this email already exists. Sign in instead.");
                    }
                    const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
                    account = { email, salt, passwordHash: await hashPassword(password, salt) };
                    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, account]));
                } else {
                    account = accounts.find((item) => item.email === email);
                    if (!account || await hashPassword(password, account.salt) !== account.passwordHash) {
                        throw new Error("Email or password is incorrect.");
                    }
                }

                localStorage.setItem(SESSION_KEY, JSON.stringify({ email: account.email }));
                window.location.replace("index.html");
            } catch (error) {
                showLoginError(error instanceof Error ? error.message : "Could not create account or sign in.");
                submitButton.disabled = false;
                submitButton.textContent = creatingAccount ? "Create account" : "Sign in";
            }
        });
    }

    function initializeProtectedPage() {
        if (!document.body.hasAttribute("data-requires-login")) {
            return;
        }

        try {
            const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
            if (!session || typeof session.email !== "string") {
                window.location.replace("login.html");
                return;
            }

            const emailLabel = document.getElementById("currentUserEmail");
            if (emailLabel) {
                emailLabel.textContent = session.email;
            }

            document.getElementById("logoutButton")?.addEventListener("click", () => {
                localStorage.removeItem(SESSION_KEY);
                window.location.replace("login.html");
            });

            window.addEventListener("storage", (event) => {
                if (event.key === SESSION_KEY && event.newValue === null) {
                    window.location.replace("login.html");
                }
            });

            document.body.style.visibility = "visible";
        } catch (error) {
            window.alert(error instanceof Error ? error.message : "Could not verify the local account.");
            window.location.replace("login.html");
        }
    }

    initializeLoginPage();
    initializeProtectedPage();
})();
