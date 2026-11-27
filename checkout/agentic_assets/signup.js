const form = document.querySelector("#signup");
const output = document.querySelector("output");
const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

async function submit(signup) {
    const fields = Object.fromEntries(new FormData(form));
    const payload = {
        monthly_volume: Number(fields.monthly_volume),
        setup_fee: Number(fields.setup_fee),
        annual_maintenance: Number(fields.annual_maintenance),
        billing: fields.billing,
    };
    const headers = { "Content-Type": "application/json" };
    if (signup) {
        Object.assign(payload, {
            business_name: fields.business_name, gst: fields.gst.toUpperCase(),
            bank_account: fields.bank_account, slug: fields.slug,
        });
        headers.Authorization = "Bearer " + fields.token;
    }
    try {
        const response = await fetch(signup ? "/signup" : "/signup/quote", {
            method: "POST", headers, body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Request failed");
        output.textContent = [
            "Tier: " + data.tier,
            "Subscription due after trial: " + rupees.format(data.subscription_due_paise / 100),
            "Estimated annual savings: " + rupees.format(data.annual_savings_paise / 100),
            "Estimate assumes a 3% aggregator MDR and a 1.5% platform share.",
        ].join("\n");
        if (signup) {
            form.reset();
            output.textContent += "\nTrial ends " + new Date(data.trial_until * 1000).toLocaleString() +
                "\nSave your API token: " + data.api_token;
        }
    } catch (error) {
        output.textContent = error.message;
    }
}

document.querySelector("#quote").addEventListener("click", () => {
    if (form.elements.monthly_volume.reportValidity()) submit(false);
});
form.addEventListener("submit", event => {
    event.preventDefault();
    submit(true);
});
