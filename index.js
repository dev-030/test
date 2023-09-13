const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const app = express();
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cors = require('cors');

const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// verify jwt
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  // console.log('this is authorization',authorization)
  
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];
  // console.log('this is token', token);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // console.log("this is decoded", decoded)
    if (err) {
      return res.status(403).send({ error: true, message: 'forbidden access' });
    }
    req.decoded = decoded;
    // console.log('decoded email ',req.decoded.email)
    next();
  });
};


app.get('/',(req,res) => {
    res.send('this server is runnig fine')
})
app.get('/',(req,res) => {
    res.send('this server is runnig fine')
})


const uri = `mongodb+srv://netpay-server:zo9XaDDcnCg58gGZ@cluster0.rfaan6v.mongodb.net/?retryWrites=true&w=majority`;
const jwtSecret = '9192730586d2d5e616cf82fe1e20543f62c792b57dfe6f7171f230cddb742d1060171ca1d1745d7bb326ee3791c12d7538e4df5820ace02a9a3642737e343744'

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();

const userCollection = client.db('Netpay').collection('userCollection');
const agentTransactionCollection = client.db('Netpay').collection('agentTransactions');
const adminTransectionCollection = client.db('Netpay').collection('adminTransectionCollection');
const userAllTransactionCollection = client.db('Netpay').collection('userAllTransactionCollection');

// create a jwt token and send clinte side
app.post('/jwt', (req, res) => {
  const user = req.body;
  // console.log("this is user",user)
  const token = jwt.sign(user, jwtSecret , {expiresIn: '6h'})

  res.send({token})

})

// user collection api
app.post('/allUsers',async (req,res) => {
  const user = req.body;
  const query = {email:user.email}
  const existingUser = await userCollection.findOne(query)
  if(existingUser){
    return res.send({message:'user already existing'})
  }
  const result = await userCollection.insertOne(user)
  res.send(result)
  
})

app.get('/allUsers', async (req, res) => {
  const result = await userCollection.find().toArray();
  res.send(result);
})

app.get('/allUsers',async(req,res) => {
  const result = await userCollection.find().toArray()
  res.send(result)
}) 

// get specific user
app.get('/allUsers/:email',async(req,res) =>{
  const userEmail = req.params.email
  const query = {email:userEmail}
  const result = await userCollection.findOne(query);
  res.send(result)
})

// check admin dashboard
app.get('/users/checkAdmin/:email',verifyJWT, async(req,res) => {
  const Email = req.params.email
  // console.log("get emails",Email)
// console.log(req.decoded)
  if(req.decoded.email!== Email){
    return res.send({admin:false})
  }
  const query = {email:Email}
  const user = await userCollection.findOne(query)
  const result = {admin : user?.role == 'admin'}
  res.send(result)
})


// check agent dashboard
app.get('/users/checkAgent/:email',verifyJWT, async(req,res) => {
  const Email = req.params.email
  const query = {email:Email}
  if(req.decoded.email !== Email){
    return res.send({agent : false})
  }
  const user = await userCollection.findOne(query)
  const result = {agent : user?.role === 'agent'}
  res.send(result)
})
// admin add money from agent
app.patch('/adminAddMoney', async (req, res) => {
  const { agentAccount, adminAccount, amount } = req.body;

  if (isNaN(amount)) {
    return res.status(400).send({ message: "Invalid Amount" });
  }

  const agentAccountNumber = await userCollection.findOne({ number: agentAccount });
  const adminAccountNumber = await userCollection.findOne({ number: adminAccount });
  console.log(agentAccountNumber);
  
  
  if (!agentAccountNumber || !adminAccountNumber) {
    return res.status(404).send({ message: "Account not found" });
  }

  const agentPreviousBalance = parseInt(agentAccountNumber.balance);
  const adminPreviousBalance = parseInt(adminAccountNumber.balance);

  if (agentPreviousBalance < amount) {
    return res.status(400).send({ message: "Insufficient balance" });
  }

  const userName = agentAccountNumber.name;
  const userPhoto = agentAccountNumber.imgUrl;

  const agentAccountUpdateBalance = agentPreviousBalance - parseInt(amount);
  const adminAccountUpdateBalance = adminPreviousBalance + parseInt(amount);
  // console.log(typeof(agentAccountUpdateBalance));
  

  await userCollection.updateOne({ number: agentAccount }, { $set: { balance: agentAccountUpdateBalance } });
  await userCollection.updateOne({ number: adminAccount }, { $set: { balance: adminAccountUpdateBalance } });

  // Log the transaction in the agentTransactions collection
  await adminTransectionCollection.insertOne({
    phone: agentAccount,
    Form: agentAccountNumber.role,
    to: adminAccountNumber.role,
    amount: amount,
    name: userName,
    imgUrl: userPhoto,
    date: new Date()
  });

  return res.send({ message: 'Add Money Successful!' });
});

  // admin to agent send money apply
  
app.patch('/adminToAgent',async(req,res) => {
  const allInfromation = req.body
  const sendAmount = parseInt(allInfromation.amount)
  if (isNaN(sendAmount)) {
    return res.status(400).send({ message: 'Invalid amount' });
  }
  const adminNumber = allInfromation.adminAccount
  const adquery = {number:adminNumber}
  const adminInfo = await userCollection.findOne(adquery)

  if (adminNumber === '') {
    return res.status(400).send({error:true, message: 'please click admin number' });
  }
 
  const agentNumber = allInfromation.agentAccount;
  const query = {number: agentNumber}
  const agent = await userCollection.findOne(query)
  
  if(agent.role !== 'agent'){
    return res.status(404).send({ message: 'Invalid agent account'});
  }
  const sendToAgentTk = adminInfo.balance - sendAmount
  const receiveMoneyFromAdmin = agent.balance + sendAmount

  await userCollection.updateOne(adquery,{$set:{balance:sendToAgentTk}})
  await userCollection.updateOne(query,{$set:{balance:receiveMoneyFromAdmin}})

  const setdatabase = await adminTransectionCollection.insertOne({Form:adminInfo.role,to:agent.role,phone:agent.number,amount:sendAmount,date:new Date()})

  return res.send(setdatabase)
})

// admin all transaction

app.get('/adminTransection',async(req,res) => {
  const result = await adminTransectionCollection.find().toArray()
  res.send(result)
})

// agent add Money
// agent add money from user
app.patch('/agentAddMoney', async (req, res) => {
  const { agentAccount, userAccount, amount } = req.body;

  if (isNaN(amount)) {
    return res.status(400).send({ message: "Invalid Amount" });
  }

  const agentAccountNumber = await userCollection.findOne({ number: agentAccount });
  const userAccountNumber = await userCollection.findOne({ number: userAccount });
  // console.log(userAccountNumber);
  
  if (!agentAccountNumber || !userAccountNumber) {
    return res.status(404).send({ message: "Account not found" });
  }

  const agentPreviousBalance = parseInt(agentAccountNumber.balance);
  const userPreviousBalance = parseInt(userAccountNumber.balance);

  if (agentPreviousBalance < amount) {
    return res.status(400).send({ message: "Insufficient balance" });
  }

  const userName = userAccountNumber.name;
  const userPhoto = userAccountNumber.imgUrl;

  const userAccountUpdateBalance = userPreviousBalance - parseInt(amount);
  const agentAccountUpdateBalance = agentPreviousBalance + parseInt(amount);
  // console.log(typeof(agentAccountUpdateBalance));
  

  await userCollection.updateOne({ number: agentAccount }, { $set: { balance: agentAccountUpdateBalance } });
  await userCollection.updateOne({ number: userAccount }, { $set: { balance: userAccountUpdateBalance } });

  // Log the transaction in the agentTransactions collection
  await agentTransactionCollection.insertOne({
    agentAccount: agentAccount,
    userAccount: userAccount,
    amount: amount,
    name: userName,
    imgUrl: userPhoto,
    timestamp: new Date()
  });

  return res.send({ message: 'Add Money Successful!' });
});
// agent Send Money 
// agent to admin send money

app.patch('/agentToAdmin', async (req, res) => {
  const { agentAccount, adminAccount, amount } = req.body;


  console.log(agentAccount, adminAccount, amount)

  if (isNaN(amount)) {
    return res.status(400).send({ message: "Invalid Amount" });
  }

  const agentAccountNumber = await userCollection.findOne({ number: agentAccount });
  const adminAccountNumber = await userCollection.findOne({ number: adminAccount });
  
  if (!agentAccountNumber || !adminAccountNumber) {
    return res.status(404).send({ message: "Account not found" });
  }

  const agentPreviousBalance = parseInt(agentAccountNumber.balance);
  const adminPreviousBalance = parseInt(adminAccountNumber.balance);

  if (agentPreviousBalance < amount) {
    return res.status(400).send({ message: "Insufficient balance" });
  }

  const userName = adminAccountNumber.name;
  const userPhoto = adminAccountNumber.imgUrl;
  const agentAccountUpdateBalance = agentPreviousBalance - amount;
  const adminAccountUpdateBalance = adminPreviousBalance + parseInt(amount);

  await userCollection.updateOne({ number: agentAccount }, { $set: { balance: agentAccountUpdateBalance } });
  await userCollection.updateOne({ number: adminAccount }, { $set: { balance: adminAccountUpdateBalance } });

  // agentTransactions collection
  await agentTransactionCollection.insertOne({
    agentAccount: agentAccount,
    userAccount: adminAccount,
    amount: amount,
    name: userName,
    imgUrl: userPhoto,
    timestamp: new Date()
  });

  return res.send({ message: 'Send Money Successful' });
});

// agent to user send money

app.patch('/agentToUser', async (req, res) => {
  const { agentAccount, userAccount, amount } = req.body;
  console.log(agentAccount,userAccount,amount)

  if (isNaN(amount)) {
    return res.status(400).send({ message: "Invalid Amount" });
  }

  const agentAccountNumber = await userCollection.findOne({ number: agentAccount });
  const userAccountNumber = await userCollection.findOne({ number: userAccount });
  
  if (!agentAccountNumber || !userAccountNumber) {
    return res.status(404).send({ message: "Account not found" });
  }

  const agentPreviousBalance = parseInt(agentAccountNumber.balance);
  const userPreviousBalance = parseInt(userAccountNumber.balance);

  if (agentPreviousBalance < amount) {
    return res.status(400).send({ message: "Insufficient balance" });
  }

  const userName = userAccountNumber.name;
  const userPhoto = userAccountNumber.imgUrl;
  const agentAccountUpdateBalance = agentPreviousBalance - parseInt(amount);
  const userAccountUpdateBalance = userPreviousBalance + parseInt(amount);

  await userCollection.updateOne({ number: agentAccount }, { $set: { balance: agentAccountUpdateBalance } });
  await userCollection.updateOne({ number: userAccount }, { $set: { balance: userAccountUpdateBalance } });

  // Log the transaction in the agentTransactions collection
  await agentTransactionCollection.insertOne({
    agentAccount: agentAccount,
    userAccount: userAccount,
    amount: amount,
    name: userName,
    imgUrl: userPhoto,
    timestamp: new Date()
  });

  return res.send({ message: 'Send Money Successful' });
});

// uniq agent Transactions 
app.get('/agentTransactions/:number', async (req, res) => {
  const agentNumber = req.params.number;
  const query = { agentAccount: agentNumber};
  const transactions = await agentTransactionCollection.find(query).toArray();
  console.log(transactions);
  res.send(transactions);
})

// all agent Transaction
app.get('/agentAllTransactions', async (req, res) => {
  const result = await agentTransactionCollection.find().toArray();
  res.send(result);
})

// sendmoney functionality apply
app.patch('/sendmoney', async (req, res) => {
  const sendmoneyInformation = req.body;

  const senderNumber = sendmoneyInformation.sdn;
  const receiverNumber = sendmoneyInformation.rcn;
  const amount = parseInt(sendmoneyInformation.tk);
  
  if (isNaN(amount)) {
    return res.status(400).send({ message: 'Invalid amount' });
  }

  const querySender = { number: senderNumber };
  const senderUser = await userCollection.findOne(querySender);

  if (!senderUser) {
    return res.status(404).send({ message: 'Sender not found' });
  }

  const sendUserpreviusbalance = senderUser.balance;
  // console.log(sendUserpreviusbalance)

  if (sendUserpreviusbalance < amount) {
    console.log('tk nai')
    return res.status(400).send({ message: 'Insufficient balance' });
  }

  const queryReceiver = { number: receiverNumber };
  const receiverUser = await userCollection.findOne(queryReceiver);

  if (!receiverUser) {
    return res.status(404).send({ message: 'Receiver not found' });
  }

  const receiveruserPreviusbalance = receiverUser.balance;
  // console.log('receiver balance',receiveruserPreviusbalance)

  const updatedSenderBalance = sendUserpreviusbalance - amount;
  const updatedReceiverBalance = receiveruserPreviusbalance + amount;

  console.log('update receiver',updatedReceiverBalance)
  console.log('update sender',updatedSenderBalance)

  await userCollection.updateOne(querySender, { $set: { balance: updatedSenderBalance } });
  await userCollection.updateOne(queryReceiver, { $set: { balance: updatedReceiverBalance } });

  console.log('Money transfer successful');
  return res.send({ message: 'Money transfer successful' });
});

// cash out to Agent
app.patch ('/cashOut',async(req, res) => {
  const {userNumber, agentNumber,cashOutAmount}= req.body;
  const cashOutConvertInt = parseInt(cashOutAmount)

  const query = {number:userNumber}
  const userInfo = await userCollection.findOne(query);
  console.log(userInfo)
  if(userInfo.balance < cashOutConvertInt){
    return res.status(400).send({ message: 'Not enough balance' });
  }
  const updateUserBalance = userInfo.balance - cashOutConvertInt

  const agentQuery = {number: agentNumber}
  const agentInfo = await userCollection.findOne(agentQuery)
  if(agentInfo.role !== "agent"){
    return res.status(404).send({ message: 'Worng agent account'});
  }
  const updateAgentBalance = agentInfo.balance + cashOutConvertInt

  await userCollection.updateOne(query,{$set:{balance:updateUserBalance}})
  await userCollection.updateOne(agentQuery,{$set:{balance:updateAgentBalance}})
  const saveInfo = await userAllTransactionCollection.insertOne({from:userInfo.role,to:agentInfo.role,receiver:agentInfo.number,balance:cashOutConvertInt,date:new Date()});
  res.send(saveInfo);

  
})


// update admin role check
app.patch('/allUsers/admin/:id', async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id)};
  const updateDoc = {
    $set: {
      role:'admin'
    },
  };
  const result = await userCollection.updateOne(filter, updateDoc);
  res.send(result);
})

// check agent
app.patch('/allUsers/agent/:id', async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id)};
  const updateDoc = {
    $set: {
      role:'agent'
    },
  };
  const result = await userCollection.updateOne(filter, updateDoc);
  res.send(result);
})

    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port,() => {
    console.log(`this server running port on ${port}`)
})