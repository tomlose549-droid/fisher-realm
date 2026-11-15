// Scene suites wait for the map bootstrap, then enter through the real selection UI.
module.exports=async function enterLake(page){
  await page.waitForFunction(()=>window.worldMap?.getState().ready||!document.querySelector('#error').hidden||!document.querySelector('#world-reload').hidden);
  if(await page.locator('#error').isVisible())throw Error(await page.locator('#error-text').textContent());
  if(await page.locator('#world-map').isVisible()){
    const marker=page.locator('#world-lake-point');
    await page.waitForFunction(()=>!document.querySelector('#world-lake-point').disabled);
    if(await page.locator('#world-preview').isHidden())await marker.click();
    await marker.click();
    await page.waitForFunction(()=>document.querySelector('#world-map').hidden||!document.querySelector('#world-reload').hidden);
    if(await page.locator('#world-map').isVisible())throw Error(await page.locator('#world-status').textContent());
  }
};
