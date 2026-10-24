import {test, expect} from '@playwright/test';

test.describe('Sauce Application Test', ()=>{

    test('Login Test', async({page}) => {

        await page.goto('https://www.saucedemo.com/');
        await page.locator('#user-name').fill('standard_user');
        await page.locator('#password').fill('secret_sauce');
        await page.locator('#login-bumo').click();

    })
})