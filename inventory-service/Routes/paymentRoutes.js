import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { verifyAuthToken } from '../middlewares/authMiddleware.js';

const paymentRouter = express.Router();

// Easebuzz configuration
const EASEBUZZ_KEY = process.env.EASEBUZZ_KEY;
const EASEBUZZ_SALT = process.env.EASEBUZZ_SALT;
const EASEBUZZ_ENV = process.env.EASEBUZZ_ENV || 'test';

const EASEBUZZ_BASE_URL = EASEBUZZ_ENV === 'prod' 
  ? 'https://pay.easebuzz.in' 
  : 'https://testpay.easebuzz.in';

// Generate hash for payment
const generateHash = (params) => {
  const hashString = `${EASEBUZZ_KEY}|${params.txnid}|${params.amount}|${params.productinfo}|${params.firstname}|${params.email}|${params.udf1 || ''}|${params.udf2 || ''}|${params.udf3 || ''}|${params.udf4 || ''}|${params.udf5 || ''}||||||${EASEBUZZ_SALT}`;
  
  return crypto.createHash('sha512').update(hashString).digest('hex');
};

// ✅ Initiate Payment
paymentRouter.post('/initiate', verifyAuthToken, async (req, res) => {
  try {
    const {
      amount,
      firstname,
      email,
      phone,
      productinfo,
      orderId,
      orderNumber,
      address,
      city,
      state,
      zipcode,
      paymentType
    } = req.body;

    // Validate required fields
    if (!amount || !firstname || !email || !phone || !productinfo || !orderId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Generate unique transaction ID
    const txnid = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Prepare payment parameters
    const params = {
      txnid: txnid,
      amount: parseFloat(amount).toFixed(2),
      productinfo: productinfo,
      firstname: firstname,
      email: email,
      phone: phone,
      udf1: orderId,           // Store order ID
      udf2: orderNumber,       // Store order number
      udf3: paymentType,       // card/upi/netbanking
      udf4: '',
      udf5: '',
    };

    // Generate hash
    const hash = generateHash(params);

    // Prepare payment data for Easebuzz
    const paymentData = {
      key: EASEBUZZ_KEY,
      txnid: params.txnid,
      amount: params.amount,
      productinfo: params.productinfo,
      firstname: params.firstname,
      phone: params.phone,
      email: params.email,
      surl: `${process.env.FRONTEND_URL}/payment/success`,
      furl: `${process.env.FRONTEND_URL}/payment/failure`,
      hash: hash,
      udf1: params.udf1,
      udf2: params.udf2,
      udf3: params.udf3,
      udf4: params.udf4,
      udf5: params.udf5,
      address1: address || '',
      city: city || '',
      state: state || '',
      country: 'India',
      zipcode: zipcode || '',
    };

    console.log('🔐 Initiating Easebuzz payment:', {
      txnid: params.txnid,
      amount: params.amount,
      orderId: orderId
    });

    // Call Easebuzz API
    const response = await axios.post(
      `${EASEBUZZ_BASE_URL}/payment/initiateLink`,
      paymentData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
    );

    console.log('✅ Easebuzz response:', response.data);

    if (response.data.status === 1) {
      res.status(200).json({
        success: true,
        data: response.data.data, // Payment URL
        txnid: params.txnid,
        message: 'Payment initiated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: response.data.data || 'Failed to initiate payment',
      });
    }
  } catch (error) {
    console.error('❌ Payment initiation error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment',
      error: error.message,
    });
  }
});

// ✅ Verify Payment Callback
paymentRouter.post('/verify', async (req, res) => {
  try {
    const {
      txnid,
      amount,
      firstname,
      email,
      productinfo,
      status,
      hash,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
      easepayid,
    } = req.body;

    console.log('🔍 Verifying payment:', {
      txnid,
      status,
      orderId: udf1,
      easepayid
    });

    // Generate hash for verification
    const hashString = `${EASEBUZZ_SALT}|${status}|||||||||||${udf5 || ''}|${udf4 || ''}|${udf3 || ''}|${udf2 || ''}|${udf1 || ''}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${EASEBUZZ_KEY}`;
    
    const calculatedHash = crypto.createHash('sha512').update(hashString).digest('hex');

    const isValid = calculatedHash === hash;

    console.log('🔐 Hash validation:', {
      isValid,
      status,
      easepayid
    });

    if (isValid && status === 'success') {
      res.status(200).json({
        success: true,
        verified: true,
        orderId: udf1,
        orderNumber: udf2,
        transactionId: easepayid,
        message: 'Payment verified successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        verified: false,
        message: 'Payment verification failed',
        status: status
      });
    }
  } catch (error) {
    console.error('❌ Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message,
    });
  }
});

export default paymentRouter;