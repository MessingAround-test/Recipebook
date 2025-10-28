import Head from 'next/head'
// import Image from 'next/image' 
import styles from '../../styles/Home.module.css'
import React from "react"
import { create } from "simple-drawing-board";


import { useEffect, useState } from 'react'
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Router from 'next/router'
import Card from 'react-bootstrap/Card';



export default function ProfilePicDrawer(props) {
    const [userData, setUserData] = useState(props.userData)
    const canvasRef = React.useRef(null);
    const [dataSeed, setDataSeed] = useState(1)
    const [savedImage, setSavedImage] = useState()

    async function saveImage() {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        setSavedImage(canvas.toDataURL("image/jpeg"));

        // alert(jpegUrl)
    }


    async function loadImage(x, y, filename, ctx) {
        var imageObj = new Image();
        imageObj.src = filename
        imageObj.onload = function () {
            ctx.drawImage(imageObj, x, y);
        }
    }


    async function generateProfilePic(n) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        loadImage(0, 0, '/head_1.png', ctx)

        const sdb = create(canvas, {
            lineColor: '#000',
            lineSize: 5,
            boardColor: 'transparent',
            historyDepth: 10
        });
        sdb.setLineSize(10)
    }





    useEffect(() => {
        if (localStorage.getItem('Token') === null || localStorage.getItem('Token') === undefined) {
            alert("please re-log in")
            Router.push("/login")
        }


        generateProfilePic();
        // console.log(await data)
    }, []) // <-- empty dependency array







    return (
        <div>


            {/* <canvas UseR="canvas" > </canvas>
                 */}
            <Card style={{ width: '80vh', color: "black", "float": "none", "margin": "0 auto" }}>
                <canvas
                    ref={canvasRef}
                    width={400} height={400}
                    style={{ backgroundColor: "white" }}
                />

                {/* <Button onClick={() => generateProfilePic(1)}>generate</Button> */}

                <Button onClick={() => saveImage()}>Save Image</Button>
                <Button onClick={() => {
                    var substate = props.gameState.substate+1
                    props.setGameState({ 'state': 'game', 'substate':  substate});
                    // Clear the canvas and change the state
                    const canvas = canvasRef.current;
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);   
                }}> Next </Button>
                {/* <Button onClick={() => console.log(userData)}>SHow state</Button> */}
            </Card>
            <Card style={{ width: '80vh', color: "black", "float": "none", "margin": "0 auto" }}>
                <img src={savedImage}></img>
            </Card>

        </div>
    )
}
