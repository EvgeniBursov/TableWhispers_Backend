const mongoose = require('mongoose');

const allergies = new mongoose.Schema({
   name: {                    // שיניתי ל-name במקום allergies_name
     type: String,
     required: true,
     unique: true            // להבטיח שאין כפילויות
   },
   description: {            // אופציונלי - תיאור האלרגיה
     type: String,
     required: false
   },
   category: {               // אופציונלי - קטגוריה (למשל: מאכלי ים, אגוזים וכו')
     type: String,
     required: false
   }
}, { timestamps: true });

module.exports = mongoose.model('allergies', allergies);