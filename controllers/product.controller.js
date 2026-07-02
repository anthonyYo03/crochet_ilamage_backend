import Product from "../models/product.model.js";
import ProductImage from "../models/productImage.model.js";

export const createProduct = async (req, res) => {
    try {
        // ── SWAPPED 'size' WITH 'height' AND 'width' ──
        const { name, category, description, price, height, width, image_url, images } = req.body;
        const user_id = req.user_id;

        // ── UPDATED VALIDATION CHECK FOR HEIGHT AND WIDTH ──
        // ── ACCEPTS EITHER LEGACY 'image_url' OR NEW 'images' ARRAY ──
        const hasImages = image_url || (Array.isArray(images) && images.length > 0);
        if (!name || !category || !description || !price || height === undefined || width === undefined || !hasImages) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // ── CREATING PRODUCT WITH THE TWO NEW FIELDS ──
        const product = await Product.create({
            name,
            category,
            description,
            price,
            height,
            width,
            image_url: image_url ?? (Array.isArray(images) ? images[0] : undefined),
            user_id
        });

        // ── CREATE MULTIPLE IMAGE ROWS IF PROVIDED ──
        if (Array.isArray(images) && images.length > 0) {
            const imageRecords = images.map((url, index) => ({
                product_id: product.product_id,
                image_url: url,
                position: index
            }));
            await ProductImage.bulkCreate(imageRecords);
        }

        const productWithImages = await Product.findByPk(product.product_id, {
            include: [{ model: ProductImage, as: 'images' }]
        });

        res.status(201).json(productWithImages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Something went wrong creating the product" });
    }
};

export const getOneProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findByPk(id, {
            include: [{ model: ProductImage, as: 'images', attributes: ['image_id', 'image_url', 'position'] }],
            order: [[{ model: ProductImage, as: 'images' }, 'position', 'ASC']]
        });

        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.status(200).json(product);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Something went wrong fetching the product" });
    }
};

export const getAllProducts = async (req, res) => {
    try {
        const { category, is_active, page = 1, limit = 20 } = req.query;
        const where = {};

        if (category) where.category = category;
        if (is_active !== undefined) where.is_active = is_active === "true";

        const offset = (Number(page) - 1) * Number(limit);

        const { count, rows } = await Product.findAndCountAll({
            where,
            limit: Number(limit),
            offset,
            order: [["createdAt", "DESC"]],
            include: [{ model: ProductImage, as: 'images', attributes: ['image_id', 'image_url', 'position'] }],
            distinct: true // required for correct 'count' when joining a hasMany relation
        });

        res.status(200).json({
            total: count,
            page: Number(page),
            totalPages: Math.ceil(count / Number(limit)),
            products: rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Something went wrong fetching products" });
    }
};

// EDIT (update) a product
export const editProduct = async (req, res) => {
    try {
        const { id } = req.params;
        // ── SWAPPED 'size' WITH 'height' AND 'width' ──
        const { name, category, description, price, height, width, image_url, images, is_active } = req.body;

        const product = await Product.findByPk(id);

        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        // ── IF 'images' ARRAY IS SENT, REPLACE THE FULL IMAGE SET ──
        // ── AND KEEP THE LEGACY 'image_url' COLUMN IN SYNC WITH THE NEW FIRST IMAGE ──
        // (this is the fix: previously image_url only updated if sent explicitly,
        // so it kept pointing at a deleted image after an images-only edit)
        let newImageUrl = image_url ?? product.image_url;

        if (Array.isArray(images)) {
            await ProductImage.destroy({ where: { product_id: id } });

            if (images.length > 0) {
                const imageRecords = images.map((url, index) => ({
                    product_id: id,
                    image_url: url,
                    position: index
                }));
                await ProductImage.bulkCreate(imageRecords);
                newImageUrl = image_url ?? images[0];
            } else {
                newImageUrl = image_url ?? null;
            }
        }

        // only update fields that were actually sent
        // ── FALLBACK CHECKS CONVERTED TO COALESCE 'height' AND 'width' ──
        await product.update({
            name: name ?? product.name,
            category: category ?? product.category,
            description: description ?? product.description,
            price: price ?? product.price,
            height: height ?? product.height,
            width: width ?? product.width,
            image_url: newImageUrl,
            is_active: is_active ?? product.is_active
        });

        const updatedProduct = await Product.findByPk(id, {
            include: [{ model: ProductImage, as: 'images', attributes: ['image_id', 'image_url', 'position'] }]
        });

        res.status(200).json(updatedProduct);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Something went wrong updating the product" });
    }
};

// DELETE a product
export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findByPk(id);

        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        // Associated ProductImage rows are removed automatically via onDelete: 'CASCADE'
        await product.destroy();

        res.status(200).json({ message: "Product deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Something went wrong deleting the product" });
    }
};

export const productController = {
    createProduct,
    getOneProduct,
    getAllProducts,
    editProduct,
    deleteProduct
};