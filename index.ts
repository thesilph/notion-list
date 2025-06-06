import { chromium } from 'playwright';
import 'dotenv/config';
import { writeFileSync } from 'fs';

async function main() {
    if (!process.env.GOOGLE_EMAIL || !process.env.GOOGLE_PASSWORD) {
        throw new Error('Google credentials not found in environment variables');
    }

    // Launch the browser
    const browser = await chromium.launch({
        headless: true,
    });


    const context = await browser.newContext({
        locale: 'en-US',
        userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36',
        viewport: { width: 1280, height: 800 },
    });

    try {
        const page = await context.newPage();
        await page.goto('https://www.notion.com');

        // Click the login button
        await page.click('text=Log in');

        await page.waitForLoadState();

        const [googlePage] = await Promise.all([
            context.waitForEvent('page'), // Start listening for new page
            page.click('div[role="button"]:has-text("Google")') // Then click the button
        ]);

        // Handle Google login
        await googlePage.waitForLoadState();

        // Fill in Google credentials
        await googlePage.fill('input[type="email"]', process.env.GOOGLE_EMAIL);
        await googlePage.click('#identifierNext');
        
        // Wait for password field and fill it
        await googlePage.waitForSelector('input[type="password"]', { state: 'visible' });
        await googlePage.fill('input[type="password"]', process.env.GOOGLE_PASSWORD);
        await googlePage.click('#passwordNext');

        // Wait for navigation back to Notion
        await googlePage.isClosed();

        console.log('Successfully logged in');

        await page.waitForSelector('#notion-app');

        await page.click('text=' + process.env.SETTINGS_LABEL || 'Settings');
        await page.waitForLoadState();
        await page.click('text=' + process.env.USERS_LABEL || "Users");
        await page.waitForLoadState();
        await page.click('div[role="tab"]:has-text("'+ ( process.env.MEMBERS_LABEL || 'Members' ) +'")');
        await page.waitForLoadState();

        console.log('Successfully navigated into members');

        // Extract data from the table
        const theadText = await page.innerText('thead');
        const tbodyText = await page.innerText('tbody');

        // Normalize multiple newlines ( rows come as \n\n\n) to \n\t\n format for consistent column separation
        const normalizedTbodyText = tbodyText.replace('\n\n\n', '\n\t\n');

        // Parse the data - split by \n\t which separates the columns
        const headers = theadText.split('\n\t').map(h => h.trim()).filter(h => h !== "");
        const rowsRaw = normalizedTbodyText.split('\n\t').map(r => r.trim()).filter(r => r !== "");

        // Now handle any remaining \n in each column (to combine username and email)
        const rows = rowsRaw.map(cell => cell.replace('\n', ' '));

        // Create CSV content
        let csvContent = headers.join(',') + '\n';
        for (let i = 0; i < rows.length; i += headers.length) {
            const row = rows.slice(i, i + headers.length).join(',');
            csvContent += row + '\n';
        }

        // Write to CSV file
        writeFileSync('data.csv', csvContent, 'utf8');
        console.log('Data written to data.csv');

        // Save screenshot
        await page.screenshot({ path: 'screenshot.png', fullPage: true });
        console.log('Screenshot saved into screenshot.png')


    } catch (error) {
        console.error('Error during execution:', error);
    } finally {
        await browser.close();
    }
}

main();