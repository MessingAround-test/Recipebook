import Head from 'next/head'
// import Image from 'next/image'
import styles from '../../styles/Home.module.css'
import React from "react"



import { useEffect, useState } from 'react'
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Router from 'next/router'



export default function ProfilePicCombiner(props) {
    const [userData, setUserData] = useState(props.userData)
    const canvasRef = React.useRef(null);
    const [dataSeed, setDataSeed]= useState(1)


    

    async function loadImage(x,y,filename, ctx){
        var imageObj = new Image();
        imageObj.src = filename
        imageObj.onload = function () {
            ctx.drawImage(imageObj, x, y);
        }
    }


    async function generateProfilePic(n) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        loadImage(0,0,'/head_1.png', ctx)
        loadImage(0,400,'/body_1.png', ctx)
        // var imageObj2 = new Image();
        // imageObj2.src = 
        // if (dataSeed == 1){
        //     
        // } else {
        //     imageObj1.src = 'https://s-media-cache-ak0.pinimg.com/236x/d7/b3/cf/d7b3cfe04c2dc44400547ea6ef94ba35.jpg'
        // }
        
        
        setDataSeed(dataSeed+1)
    }





    useEffect(() => {
        if (localStorage.getItem('Token') === null || localStorage.getItem('Token') === undefined) {
            alert("please re-log in")
            Router.push("/login")
        }


        // generateProfilePic();
        // console.log(await data)
    }, []) // <-- empty dependency array







    return (
        <div>


            {/* <canvas UseR="canvas" > </canvas>
                 */}
            <canvas
                ref={canvasRef}
                width={800} height={800}
            />
            <Button onClick={() => generateProfilePic(1)}>generate</Button>


            <Button onClick={() => console.log(userData)}>SHow state</Button>



        </div>
    )
}
