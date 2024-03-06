import { secret } from "../../../lib/dbsecret";
import { verify } from "jsonwebtoken";
import * as qna from '@tensorflow-models/qna';
import '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import '@tensorflow/tfjs-backend-webgl';

let modelPromise = qna.load();  // Load the Q&A model directly
let search;
let input;
let contextDiv;
let answerDiv;

export default async function handler(req, res) {
  let question = req.body.question;

  // verify(req.query.EDGEtoken, secret, async function (err, decoded) {
  //   if (err) {
  //     res.status(400).json({ res: "error: " + String(err) })
  //   } else {
  if (req.method === "POST") {
    const model = await modelPromise;
    const answers = await model.findAnswers(question, "CONTEXT")
    res.status(200).json({ data: answers });
  } else {
    res.status(400).json({ success: false, data: [], message: "Not supported request" });
  }
  //   }
  // });
}
