const express = require('express');
const router = express.Router();

const { validateSurvey,submitSurvey,getRestaurantSurveysDetailed } = require('../MessageSystem/Survey')


router.get('/validate-survey', validateSurvey);

router.post('/submit-survey', submitSurvey);

router.get('/getRestaurantSurveysDetailed/:id', getRestaurantSurveysDetailed);



module.exports = router;
