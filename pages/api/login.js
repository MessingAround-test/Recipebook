import dbConnect from '../../lib/dbConnect'
import User from '../../models/User'
import {compare} from "bcrypt"
import { sign} from "jsonwebtoken"
import {secret} from "../../lib/dbsecret"


/**
 * @swagger
 * /api/login:
 *   post:
 *     description: Returns Token from Login
 *     responses:
 *       200:
 *         description: hello world
 */

export default async function handler (req, res) {
    if (req.method === "POST"){
        await dbConnect()
        // const users = await User.find({email: req.email})
        try {
            var status = await loginUser(req.body);
            if (status) {
                // generate a access token
                const accessToken = await sign(
                    { id: status._id, email: status.email, role: status.role },
                    secret
                );
                res.status(200).json({ success: true, data: {token: accessToken}, message: "Success" })
            } else {
                throw "incorrect Email or Password";
            }
        } catch (error) {
            console.log(error);
            res.status(400).json({ success: false, data: {}, message: error })
        }
    } else {
        res.status(400).json({ success: false, data: [], message: "Only support POST" })
    }
    
}




// const mongoose = require('mongoose')



// const bcrypt = require("bcrypt");
// const jwt = require("jsonwebtoken");
// // How many times the PW is salted
// const saltRounds = 10;

// const accessTokenSecret = "TEST123233232";


// // const config = require("config");
// // const port = config.get("server.port");
// // 

// // connects to the mongo DB 
// connect()


// // Allowed CORS access
// app.use((req, res, next) => {
//   res.append("Access-Control-Allow-Origin", [
//     "http://localhost:8080",
//   ]);
//   res.append("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
//   res.append("Access-Control-Allow-Headers", "Content-Type");
//   next();
// });

// app.get('/', async(req, res) => {
//   // await connect()
//   var item = await find()
//   // console.log(item)
//   res.send(item)
// })


// // START OF REGISTRATION STUFF
// app.post("/register", async (req, res) => {
//   try {
//     // Add some validation back in
//     // req.assert('username', 'Name is required').notEmpty()           //Validate name
//     // req.assert('email', 'A valid email is required').isEmail()
//     // req.assert('password', 'Password is required').notEmpty();

//     var status = await createUser(req.body);
//     res.send({ success: status });
//   } catch (error) {
//     console.log(error);

//     res.send({ error: error });
//   }
//   // res.redirect("/hello")
// });

// app.post("/login", async (req, res) => {
//   try {
//     var status = await loginUser(req.body);
//     if (status) {
//       // generate a access token
//       console.log("STATIS");
//       console.log(status);
//       const accessToken = await jwt.sign(
//         { id: status._id, email: status.email, role: status.role },
//         accessTokenSecret
//       );
//       res.send({ success: true, token: accessToken });
//     } else {
//       throw "incorrect Email or Password";
//     }
//   } catch (error) {
//     console.log(error);
//     res.send({ error: error });
//   }
// });


// app.get("/adminGetUsers", async (req, res) => {
//   const token = req.query.token;
//   if (token) {
//     const userInfo = await verifyToken(token);
//     console.log(userInfo);
//     if (userInfo) {
//       if (userInfo.role === "admin") {
//         // {} empty filter gets ALL results
//         const allUsers = await findUsers({});
//         res.send({ success: true, users: allUsers });
//       } else {
//         res.send({ error: "Unauthorized" });
//       }
//     } else {
//       res.send({ error: "Invalid Token" });
//     }
//   } else {
//     res.send({ error: "Please include Access Token" });
//   }
// });

// app.put("/adminUpdateUser", async (req, res) => {
//   var token = req.query.token;
//   if (token) {
//     var userInfo = await verifyToken(token);
//     console.log(userInfo);
//     if (userInfo) {
//       if (userInfo.role === "admin") {
//         // {} empty filter gets ALL results
//         var updated = await updateUser(
//           { _id: req.body.data.id },
//           req.body.data.update
//         );
//         res.send({ success: true, updatedUser: updated });
//       } else {
//         res.send({ error: "Unauthorized" });
//       }
//     } else {
//       res.send({ error: "Invalid Token" });
//     }
//   } else {
//     res.send({ error: "Please include Access Token" });
//   }
// });

// // Creates a schema in our DB with this look, if it already exists then good :) we can query it
// const userModel = mongoose.model(
//   "Users",
//   new mongoose.Schema(
//     {
//       username: String,
//       email: { type: String, unique: true, index: true, required: true },
//       password: String,
//       role: { type: String, required: true },
//       approved: { type: Boolean, required: true },
//       passwordHash: String,
//       extraField: String,
//     },
//     { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
//   ),

//   "Users"
// );

// const transactions = mongoose.model('transactions', new mongoose.Schema({ parent_id: String, Description: String, amount: Number, payed: Boolean, split: Number, user: String}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }), 'transactions');


// async function findUsers(filter) {
//   // we don't want to filter on anything
//   const doc = await userModel.find(filter);
//   return doc;
// }

// async function updateUser(filter, update) {
//   // we don't want to filter on anything
//   const doc = await userModel.findOneAndUpdate(filter, update);
//   console.log(filter);
//   console.log(update);
//   // const doc = await userModel.findOne(filter);
//   return doc;
// }

// async function createUser(body) {
//   // userModel.
//   const username = body.username;
//   const password = body.password;
//   const email = body.email;
//   const role = "user";
//   const approved = false;
//   console.log(username + ": " + password + ": " + email);
//   const hash = await bcrypt.hash(password, saltRounds);
//   const res = userModel.create({
//     username: username,
//     email: email,
//     password: password,
//     passwordHash: hash,
//     approved: approved,
//     role: role,
//   });
//   console.log(await res);
//   return res;
// }

async function loginUser(body) {
  const password = body.password;
  const email = body.email;
  // Email is the primary key
  console.log(password + " : "+ email)
  const user = await User.find({ email: email });
  console.log(user);
  if (user.length > 0) {
    console.log(user[0].passwordHash + ":" + password);
    const res = await compare(password, user[0].passwordHash);
    if (res == true) {
      // If the password matches
      return user[0];
    } else {
      return null;
    }
  } else {
    console.log("User not found from email: " + email);
    return null;
  }
}

// async function verifyToken(token) {
//   // return await
//   try {
//     var decoded = await jwt.verify(token, accessTokenSecret);
//     return decoded;
//   } catch (err) {
//     return err;
//     // err
//   }
// }


// // END OF REGISTRATION SUFF


// app.get('/transactions', async(req, res) => {
//   // await connect()
//   console.log(req.query)
//   var item = await get_user_transactions(req.query.email)
//   // console.log(item)
//   res.send(item)
// })



// app.post('/transactions', async(req, res) => {
//   // await connect()
//   console.log(req.body)
//   var item = await create_transaction(req.body.parent_id, req.body.Description, req.body.amount, req.body.payed, req.body.split, req.body.user)
//   // console.log(item)
//   res.send(item[0])
// })


// app.get('/subTransactions', async(req, res) => {
   
//   console.log(req.query)
//   // await connect()
//   var item = await get_user_sub_transactions(req.query.email)
//   // console.log(item)
//   res.send(item)
// })


// // Creates a schema in our DB with this look, if it already exists then good :) we can query it
// // const testModel = mongoose.model('testCollection', new mongoose.Schema({ name: String, age: Number }), 'testCollection');
// // const users = mongoose.model('users', new mongoose.Schema({ name: String, age: Number, email: String, password: String}), 'users');




// async function connect() {
//   await mongoose.connect('mongodb://admin:admin@db:27017/');
//   // console.log('asdasd')
//   // Only run for a data reset
//   // run_data_setup()
// }

// // Search the schema we created above to see if any data is in there.
// async function find() {
//   const doc = await transactions.find({});
//   return doc
// }


// async function find_tran_by_id(id) {
//   const doc = await transactions.findOne({_id: id});
//   return doc
// }




// async function create_transaction(parent_id, Description, amount, payed, split, user) {
//   var newtran  = [{parent_id: parent_id, Description: Description, amount: amount, payed: payed, split: split, user: user}]
//   return transactions.insertMany(newtran)
// }


// async function create_sub_transaction(parent_id, Description, split, user){
//   var doc = await find_tran_by_id(parent_id)
//   if (doc !== undefined){
//     create_transaction(parent_id, Description, doc.amount/split, false, split, user)
//   }
// }





// // async function create_user(name, age, email, password) {
// //   var newuser  = [{name:name, age:age, email:email, password:password}]
// //   users.insertMany(newuser)
// // }


// async function get_user_transactions(email) {
//   const doc = await transactions.find({user: email});
//   return doc
// }

// async function get_user_sub_transactions(email){
//   var doc = await transactions.find({user: email});
//   var allsubdocs = []

//   for (var tran in doc){
//     console.log(doc[tran])
//     // console.log(tran)
//     var subdoc = await transactions.find({parent_id: doc[tran]._id});
//     allsubdocs = allsubdocs.concat(subdoc)
//   }
//   return allsubdocs
// }

// async function run_data_setup(){
//   transactions.find({}).remove().exec();
//   userModel.find({}).remove().exec();

//   createUser({"username": "Bryn","email": "lombryn@gmail.com", "password": "asdasd"})
//   var data= await create_transaction(null, "TestTran", 10, false, 1, "lombryn@gmail.com")
//   var data= await create_transaction(null, "TestTran2", 20, false, 1, "lombryn@gmail.com")
//   var parent_id = data[0].id 
//   create_sub_transaction(parent_id, "SubTran", 3, "test123@gmail.com")
  

//   // create_transaction(null, "TestTran", 10, false, 1, "test123@gmail.com")

//   // remove old  data
  
//   // dayAttachment.find({}).remove().exec();
//   // goal.find({}).remove().exec();




//   // // insert 
//   // const weekdays = [{name:"Monday", order: 0}, {name:"Tuesday", order: 1},{name:"Wednesday", order: 2},{name:"Thursday", order: 3},{name:"Friday", order: 4},{name:"Saturday", order: 5},{name:"Sunday",   order: 6},]
//   // weekDay.insertMany(weekdays)
//   // const weekdayTasks = [{ type: "Gym", name: "Gym", outcome: false, date_order_id: 0 },{ type: "Gym", name: "Gym", outcome: false, date_order_id: 1 },{ type: "Gym", name: "Gym", outcome: false, date_order_id: 2 }]
//   // dayAttachment.insertMany(weekdayTasks)


// }




// app.listen(port, () => {
//   console.log(`Example app listening at http://localhost:${port}`)
// })
