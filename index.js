const puppeteer = require('puppeteer');
const fs = require('fs');
const neatCsv = require('neat-csv');
const creds = {
    email: "username",
    password: "password"
};
const baseUrl = 'https://mfptestzach.wpengine.com';
(async () => {
    // launch browser instance headless: true to watch it do it's magic
    const browser = await puppeteer.launch({headless: true});
    // create new tab
    const page = await browser.newPage();
    // attempt to get to WordPress's admin dashboard
    await page.goto(`${baseUrl}/wp-admin`);
    // if redirected to wp-login.php you're logged out
    if (page.url().toString().indexOf('wp-login.php') >= 0) {
        await login(page)
    }
    // kind of ugly but was the simplest way to iterate through this async
    fs.readFile('images.csv', async (err, data) => {
        if (err) {
            console.error(err)
            return
        }
        const csv = await neatCsv(data);
        console.log('opened CSV, reading rows')
        for await (let row of csv) {
            // neat CSV imports as an array of objects vs the preferred array of arrays.
            if (row['TRUE'] === 'TRUE') {
                let image;
                // this ugly bit parses the live URL (https://blog.myfitnesspal.com.... and the actual name of the image file
                Object.keys(row).forEach(key => {
                    if ( key.indexOf('http') >= 0) {
                        image = `images/${row[key].substring(row[key].lastIndexOf('/') + 1).replace(/\.png$/, ".jpg")}`
                    }
                })
                console.log(`Replacing image ID: ${row['6530']}`)
                await replaceImage(row['6530'], image, browser)
                console.log(`SuccessfullyReplaced image ID: ${row['6530']}`)
            }
        }
    })

    await browser.close();
})();

async function replaceImage(imageId, imagePath, currentBrowser) {
    let page = await currentBrowser.newPage();
    // this is a hack to work around it taking more than 30s to upload in image in my testing
    await page.setDefaultNavigationTimeout(0);
    // navigate to specific images edit page
    await page.goto(`${baseUrl}/wp-admin/post.php?post=${imageId}&action=edit`);
    // xPath for replace image button I can't navigat to this directly because there is session data included in the URL
    let button = await page.$("#emr-replace-box > div.inside > p:nth-child(1) > a")
    await button.click()
    await page.waitForNavigation();

    await page.waitForSelector('input[type=file]');
    await page.waitFor(1000);
    const inputUploadHandle = await page.$('input[type=file]');
    await inputUploadHandle.uploadFile(imagePath);
    let label = await page.$('#replace_type_2')
    await label.click()
    let uploadButton = await page.$("input#submit");
    await uploadButton.click();
    await page.waitForNavigation();
    await page.close()
}
async function login(page) {
    // this fixes an issue whre the email isn't fully entered
    await page.waitFor(5000)
    await page.type('#user_login', creds.email);
    await page.type('#user_pass', creds.password);
    await page.click('#wp-submit');
    // return after new page is loaded
    await page.waitForNavigation();
}
