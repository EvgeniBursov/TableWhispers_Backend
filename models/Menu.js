const mongoose = require('mongoose');

/*const MenuSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    category: {
        type: String,
        enum: ['Appetizers', 'Main Course', 'Side Dishes', 'Desserts','Drinks'],
        required: true
    }
});*/

const MenuItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    category: {
        type: String,
        enum: ['Appetizers', 'Main Course', 'Side Dishes', 'Desserts', 'Drinks'],
        required: true
    }
});

const MenuSchema = new mongoose.Schema({
    menus: [
        {
            title: {
                type: String,
                required: true
            },
            items: [MenuItemSchema]  
        }
    ]
});

module.exports = mongoose.model('MenuCollection', MenuSchema);


//module.exports = mongoose.model('MenuSchema', MenuSchema);
