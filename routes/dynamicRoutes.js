import express from 'express';
const router = express.Router();
import { isLoggedIn } from "../middleware/isLoggedIn.js";
import { allowRoles } from "../middleware/allowRoles.js";
import ItemDefinition from "../models/ItemDefinition.js";


// 1. ADD PAGE RENDER
router.get('/add', isLoggedIn, allowRoles("admin", "worker"), async (req, res) => {
    try {
        const role = req.user.role;
        const brands = await ItemDefinition.distinct("brandName");
        res.render('addDynamicData', { role, brands });
    } catch (err) {
        console.error("Error fetching brands:", err);
        res.render('addDynamicData', { role: req.user.role, brands: [] });
    }
});

// 2. API: GET ITEMS FOR A SPECIFIC BRAND
router.get('/api/get-items/:brandName', isLoggedIn,allowRoles("admin", "worker"), async (req, res) => {
    try {
        const brand = await ItemDefinition.findOne({ 
            brandName: { $regex: new RegExp(`^${req.params.brandName}$`, "i") } 
        });
        if (brand) {
            const itemNames = brand.products.map(p => p.itemName);
            res.json(itemNames);
        } else {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json([]);
    }
});


// 3. POST: ADD OR UPDATE ITEM (Merging Colors Logic Added)
router.post('/add-item', isLoggedIn, allowRoles("admin", "worker"), async (req, res) => {
    try {
        const { itemsList, brandName, colors, units } = req.body;
        
        // 🟢 Trim brand name to avoid leading/trailing spaces
        const finalBrandName = brandName.trim(); 

        let brandDoc = await ItemDefinition.findOne({ 
            brandName: { $regex: new RegExp(`^${finalBrandName}$`, "i") } 
        });

        if (!brandDoc) {
            const products = itemsList.map(name => ({
                itemName: name.trim(), // 🟢 Items ko bhi trim karein
                hasColors: colors.length > 0,
                colors: colors
            }));
            // Ab brandName waisa hi save hoga jaisa aapne bheja
            brandDoc = new ItemDefinition({ brandName: finalBrandName, units, products });
        } else {
            if (units && units.length > 0) {
                brandDoc.units = [...new Set([...brandDoc.units, ...units])];
            }

            itemsList.forEach(itemName => {
                const cleanItemName = itemName.trim();
                const idx = brandDoc.products.findIndex(p => p.itemName.toLowerCase() === cleanItemName.toLowerCase());
                
                if (idx > -1) {
                    const oldColors = brandDoc.products[idx].colors || [];
                    colors.forEach(newCol => {
                        // 🟢 Case-insensitive color check
                        const exists = oldColors.some(c => c.colour.toLowerCase() === newCol.colour.toLowerCase());
                        if (!exists) oldColors.push(newCol);
                    });
                    brandDoc.products[idx].colors = oldColors;
                    brandDoc.products[idx].hasColors = oldColors.length > 0;
                } else {
                    brandDoc.products.push({ 
                        itemName: cleanItemName, 
                        hasColors: colors.length > 0, 
                        colors 
                    });
                }
            });
        }

        await brandDoc.save();
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});



// 4. ALL DATA VIEW
router.get('/all', isLoggedIn, allowRoles("admin", "worker"), async (req, res) => {
    try {
        const role = req.user.role;
        const allDefinitions = await ItemDefinition.find().sort({ brandName: 1 });
        res.render('allDynamicData', { role, allDefinitions });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});



// 5. DELETE FULL BRAND
router.get('/delete-brand/:id', isLoggedIn, allowRoles("admin"), async (req, res) => {
    try {
        await ItemDefinition.findByIdAndDelete(req.params.id);
        res.redirect('/dynamic/all');
    } catch (err) {
        res.status(500).send("Error deleting brand");
    }
});



// 6. DELETE SPECIFIC PRODUCT FROM BRAND
router.get('/delete-product/:brandId/:productId', isLoggedIn, allowRoles("admin"), async (req, res) => {
    try {
        await ItemDefinition.findByIdAndUpdate(req.params.brandId, {
            $pull: { products: { _id: req.params.productId } }
        });
        res.redirect('/dynamic/all');
    } catch (err) {
        res.status(500).send("Error deleting product");
    }
});



export default router;