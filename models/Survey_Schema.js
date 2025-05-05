const mongoose = require('mongoose');

const surveyResponseSchema = new mongoose.Schema({
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserOrder',
    required: true
  },
  ratings: {
    food: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    service: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    ambiance: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    cleanliness: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    overall: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    }
  },
  submitted_at: {
    type: Date,
    default: Date.now
  },
}, { timestamps: true });

// Calculate average rating
surveyResponseSchema.virtual('averageRating').get(function() {
  const ratings = this.ratings;
  return (ratings.food + ratings.service + ratings.ambiance + 
          ratings.cleanliness + ratings.overall) / 5;
});

// Add index for order_id to prevent multiple submissions for same order
surveyResponseSchema.index({ order_id: 1 }, { unique: true });

module.exports = mongoose.model('SurveyResponse', surveyResponseSchema);