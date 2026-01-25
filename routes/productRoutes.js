import express from 'express';
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";
import Item from '../models/Item.js';
import ItemDefinition from "../models/ItemDefinition.js";
import { isLoggedIn } from "../middleware/isLoggedIn.js";
import { allowRoles } from "../middleware/allowRoles.js";
import moment from 'moment-timezone'; // 🟢 Library Import


const router = express.Router();

/* ================================
   🟢 1️⃣ Add Product Page (GET)
   -> Renders the Add Product form (EJS)
================================ */
// 🟢 Add Product Page (GET)
router.get("/add", isLoggedIn, allowRoles("admin", "worker"), async (req, res) => {
    const role = req.user.role;
    try {
        // 🟢 Database se sara dynamic data fetch karein
        const definitions = await ItemDefinition.find().sort({ brandName: 1 });
        const products = await Product.find().sort({ itemName: 1 });

        // 'definitions' ko frontend par bhej dein
        res.render("addProduct", { products, definitions, layout: false, role });

    } catch (err) {
        console.error("❌ Error loading Add Product page:", err);
        res.status(500).send("Error loading Add Product page");
    }
});


/* ================================
   🟢 2️⃣ Add Multiple Products (POST)
   -> Adds multiple products at once
================================ */
// 🔹 Add multiple products at once
router.post("/add-multiple", isLoggedIn, allowRoles("admin", "worker"), async (req, res) => {
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, message: "No products provided." });
    }

    // 1. Data Prepare (Wahi logic jo aapne di thi)
    const formatted = products.map((p) => ({
      brandName: p.brandName,
      itemName: p.itemName,
      colourName: p.colourName,
      qty: p.qty,
      totalProduct: p.totalProduct,
      remaining: p.totalProduct, 
      rate: p.rate,
      stockID: p.stockID
    }));

    // 2. High Speed Insert
    // ordered: false ka matlab hai agar ek product mein error aaye 
    // to baaqi rukenge nahi, wo save hote jayenge. Ye insertMany ko mazeed fast kar deta hai.
    await Product.insertMany(formatted, { ordered: false });

    res.json({ success: true, message: `${products.length} Products added successfully!` });
  } catch (err) {
    // Agar duplicate stockID ka error aaye tab bhi ye catch mein jayega
    console.error("❌ Failed to save products:", err);
    res.status(500).json({ success: false, message: "Server error: " + err.message });
  }
});



/* ================================
   🟢 3️⃣ All Products Page (GET)
   -> Shows all products with stats
================================ */
// 🟢 3️⃣ All Products Page (GET) — with filters

const PKT_TIMEZONE = "Asia/Karachi"; 

// Regex escape function
function escapeRegExp(string) {
    if (!string) return "";
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 🟢 ALL PRODUCTS ROUTE (Corrected Model Name)
router.get("/all", isLoggedIn, allowRoles("admin", "worker"), async (req, res) => {
    const role = req.user.role;

    try {
        let { filter, from, to, brand, itemName, colourName, unit, stockStatus, refund } = req.query;

        // 🟢 FIX: ItemDefinition use karein kyunke upar isi naam se import hai
        const definitions = await ItemDefinition.find({}).lean();

        if (!filter) { filter = "month"; }

        let query = {};
        let start, end;
        let dateOperator = '$lte';
        const nowPKT = moment().tz(PKT_TIMEZONE);

        // --- Date Logic ---
        if (filter === "today") {
            start = nowPKT.clone().startOf('day').toDate();
            end = nowPKT.clone().endOf('day').toDate();
        } else if (filter === "yesterday") {
            const yesterday = nowPKT.clone().subtract(1, 'days');
            start = yesterday.startOf('day').toDate();
            end = yesterday.endOf('day').toDate();
        } else if (filter === "month") {
            start = nowPKT.clone().startOf('month').toDate();
            end = nowPKT.clone().endOf('day').toDate();
        } else if (filter === "lastMonth") {
            const lastMonth = nowPKT.clone().subtract(1, 'months');
            start = lastMonth.startOf('month').toDate();
            end = lastMonth.endOf('month').toDate();
        } else if (filter === "custom" && from && to) {
            dateOperator = '$lt';
            const f = moment.tz(from, 'YYYY-MM-DD', PKT_TIMEZONE);
            let t = moment.tz(to, 'YYYY-MM-DD', PKT_TIMEZONE);
            t.add(1, 'days').startOf('day');
            if (f.isValid() && t.isValid()) {
                start = f.startOf('day').toDate();
                end = t.toDate();
            }
        }

        if (start && end) {
            query.createdAt = { $gte: start, [dateOperator]: end };
        }

        // --- Filters Logic ---
        if (brand && brand !== "all") {
            query.brandName = new RegExp(`^${escapeRegExp(brand)}$`, "i");
        }
        if (itemName && itemName !== "all") {
            query.itemName = new RegExp(`^${escapeRegExp(itemName)}$`, "i");
        }
        if (colourName && colourName !== "all") {
            query.colourName = new RegExp(`^${escapeRegExp(colourName)}$`, "i");
        }
        if (unit && unit !== "all") {
            query.qty = new RegExp(escapeRegExp(unit), "i");
        }
        if (stockStatus && stockStatus !== "all") {
            query.remaining = stockStatus === "in" ? { $gt: 0 } : { $eq: 0 };
        }
        if (refund && refund !== "all") {
            if (refund === "both") {
                query.refundStatus = { $in: ["Partially Refunded", "Fully Refunded"] };
            } else {
                query.refundStatus = refund;
            }
        }

        const filteredProducts = await Product.find(query).sort({ createdAt: -1 }).lean();

        // --- Stats Calculation ---
        let totalStock = 0, totalRemaining = 0, totalValue = 0, remainingValue = 0, totalRefundedValue = 0;
        
        filteredProducts.forEach(p => {
            const rate = parseFloat(p.rate || 0);
            const totalProd = parseFloat(p.totalProduct || 0);
            const remaining = parseFloat(p.remaining || 0);
            const refundQty = parseFloat(p.refundQuantity || 0);

            totalStock += totalProd;
            totalValue += (totalProd * rate);
            totalRemaining += Math.min(remaining, totalProd);
            totalRefundedValue += (Math.min(refundQty, totalProd) * rate);
            remainingValue += (remaining * rate);
        });

        const responseData = {
            products: filteredProducts,
            definitions, 
            stats: { 
                totalStock, 
                totalRemaining, 
                totalValue: parseFloat(totalValue.toFixed(2)), 
                remaining: parseFloat(remainingValue.toFixed(2)), 
                totalRefundedValue: parseFloat(totalRefundedValue.toFixed(2)) 
            },
            filter, from, to,
            selectedBrand: brand || "all",
            selectedItem: itemName || "all",
            selectedColour: colourName || "all",
            selectedUnit: unit || "all",
            stockStatus: stockStatus || "all",
            selectedRefund: refund || "all",
            role
        };

        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.json({ success: true, ...responseData });
        }

        res.render("allProducts", responseData);

    } catch (err) {
        console.error("❌ Error loading All Products:", err);
        res.status(500).send("Error loading products page");
    }
});



/* ================================
   🟢  Delete Product (DELETE)
================================ */
router.delete("/delete-product/:id",isLoggedIn,allowRoles("admin"), async (req, res) => {
  try {
    const productId = req.params.id;
    const deletedProduct = await Product.findByIdAndDelete(productId);
    if (!deletedProduct) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    res.json({ success: true, message: "Product deleted successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error deleting Product" });
  }
});




router.get('/print', isLoggedIn, allowRoles("admin", "worker"), (req, res) => {
  let currentDate;
  
  // Timezone Logic (Same as before)
  if (process.env.NODE_ENV === 'production') {
    currentDate = new Date().toLocaleString('en-US', { 
      timeZone: 'Asia/Karachi',
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
  } else {
    currentDate = new Date().toLocaleString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
  }

  // ✅ AB DATA NAHI BHEJNA: products array ko nikal diya
  // Kyunke data ab browser ki memory (LocalStorage) se aayega
  res.render('printProducts', { currentDate }); 
});



router.get('/refund',isLoggedIn,allowRoles("admin", "worker"),(req,res)=>{
const role=req.user.role;
res.render('refundProducts',{role});
});



router.post('/refund', isLoggedIn, allowRoles("admin", "worker"), async (req, res) => {
  try {
    let { stockID, refundQuantity } = req.body;
    
    // Number conversion handle karen safely
    const qty = Number(refundQuantity);

    if (!stockID || isNaN(qty) || qty <= 0) {
      return res.status(400).send("❌ Invalid Input: Quantity must be a number");
    }

    const product = await Product.findOne({ stockID });
    if (!product) return res.status(400).send("❌ Product not found");

    if (qty > product.remaining) {
      return res.status(400).send(`❌ Stock short! Available: ${product.remaining}`);
    }

    product.remaining -= qty;
    product.refundQuantity = (product.refundQuantity || 0) + qty;
    
    // Status update
    product.refundStatus = product.refundQuantity >= product.totalProduct ? "Fully Refunded" : "Partially Refunded";

    await product.save();
    res.send(`✅ Refund successful! ${qty} items returned to company.`);

  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Server Error");
  }
});



// Use export default to export the router in ES Modules
export default router;
