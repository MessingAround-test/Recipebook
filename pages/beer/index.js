import Head from 'next/head'
import Image from 'next/image'
import styles from '../../styles/Home.module.css'



import { Toolbar } from '../Toolbar'
import { useEffect, useState } from 'react'
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Router from 'next/router'
import Card from 'react-bootstrap/Card'
import MultiStepForm from '../../components/MultiStepForm'
import BigCarousel from '../../components/BigCarousel'



export default function Home() {
    const [userData, setUserData] = useState({})
    const [recipes, setRecipes] = useState([])

    async function getUserDetails() {
        let data = await (await fetch("/api/UserDetails?EDGEtoken=" + localStorage.getItem('Token'))).json()
        console.log(data)
        setUserData(data.res)
    }



    useEffect(() => {
        if (localStorage.getItem('Token') === null || localStorage.getItem('Token') === undefined) {
            alert("please re-log in")
            Router.push("/login")
        }

        getUserDetails();
        // getRecipeDetails();
        // console.log(await data)
    }, []) // <-- empty dependency array


    const redirect = async function (page) {
        Router.push(page)
    };


    const imageList = [
        { name: 'Bakery', url: '/beers/LOUIS.jpg' },
        { name: 'Image 2', url: '/beers/MUMANDDAD.jpg' },
        { name: 'Image 3', url: '/beers/ME.jpg' },
      ];

    const brewingQuestions = ([
        {id: 0,
          text: 'How big a batch would you like?',
          type: 'carousel',
          options: [
            { text: '5L', additionalInfo: '16 cans' },
            { text: '20L', additionalInfo: '1 keg' }
          ],
          selectedOption: '',
          answer: '',},
        {
          id: 1,
          text: 'What type of malt would you like to use?',
          type: 'carousel',
          options: [
            { text: 'Pale Malt', additionalInfo: 'Light and mild flavor.' },
            { text: 'Crystal Malt', additionalInfo: 'Sweetness with caramel notes.' },
            { text: 'Chocolate Malt', additionalInfo: 'Dark color with chocolate/coffee flavors.' },
          ],
          selectedOption: '',
          answer: '',
        },
        {
          id: 2,
          text: 'Which hops flavor profile do you prefer?',
          type: 'carousel',
          options: [
            { text: 'Citrus', additionalInfo: 'Bright, zesty, and fruity notes.' },
            { text: 'Floral', additionalInfo: 'Flowery and aromatic character.' },
            { text: 'Spicy', additionalInfo: 'Peppery or herbal flavor.' },
          ],
          selectedOption: '',
          answer: '',
        },
        {
          id: 3,
          text: 'Choose a yeast strain for fermentation:',
          type: 'carousel',
          options: [
            { text: 'Ale Yeast', additionalInfo: 'Fruity and complex flavors.' },
            { text: 'Lager Yeast', additionalInfo: 'Clean and crisp profile.' },
            { text: 'Wheat Yeast', additionalInfo: 'Light and refreshing character.' },
          ],
          selectedOption: '',
          answer: '',
        },
        {
          id: 4,
          text: 'Select a beer style you want to brew:',
          type: 'carousel',
          options: [
            { text: 'IPA', additionalInfo: 'Hop-forward flavors and aromas.' },
            { text: 'Stout', additionalInfo: 'Dark and rich with roasted malt and chocolate notes.' },
            { text: 'Wheat Beer', additionalInfo: 'Light and refreshing with hints of citrus.' },
          ],
          selectedOption: '',
          answer: '',
        },
        {
          id: 5,
          text: 'Describe the flavor profile you\'re aiming for:',
          type: 'text',
          answer: '',
        },
        {
          id: 6,
          text: 'Preference for a more hoppy, malty, or balanced taste?',
          type: 'carousel',
          options: [
            { text: 'Hoppy', additionalInfo: 'Emphasizes hop bitterness and aroma.' },
            { text: 'Malty', additionalInfo: 'Focuses on the sweetness and richness of malt.' },
            { text: 'Balanced', additionalInfo: 'Harmonious blend of hop and malt characteristics.' },
          ],
          selectedOption: '',
          answer: '',
        },
        {
          id: 7,
          text: 'Target alcohol content level:',
          type: 'text',
          answer: '',
        },
        {
          id: 8,
          text: 'Preferred brewing method:',
          type: 'carousel',
          options: [
            { text: 'Extract', additionalInfo: 'Simplified method using malt extract.' },
            { text: 'Partial Mash', additionalInfo: 'Combines extract and mashing grains for added control.' },
            { text: 'All-Grain', additionalInfo: 'Involves mashing grains for complete brewing control.' },
          ],
          selectedOption: '',
          answer: '',
        },
        {
          id: 9,
          text: 'Do you have a preferred brewing system or equipment?',
          type: 'text',
          answer: '',
        },
        {
          id: 10,
          text: 'Brewing location (e.g., home, backyard):',
          type: 'text',
          answer: '',
        },
        {
          id: 11,
          text: 'Fermentation temperature range:',
          type: 'text',
          answer: '',
        },
        {
          id: 12,
          text: 'Preferred fermentation duration:',
          type: 'text',
          answer: '',
        },
        {
          id: 13,
          text: 'Additional ingredients for flavor enhancement:',
          type: 'text',
          answer: '',
        },
        {
          id: 14,
          text: 'Considered dry hopping or adding adjuncts?',
          type: 'carousel',
          options: [
            { text: 'Yes', additionalInfo: 'Dry Hopping: Adds hop aroma and flavor without increasing bitterness.\nAdjuncts: Additional ingredients for flavor enhancement.' },
            { text: 'No', additionalInfo: 'No additional processes considered.' },
          ],
          selectedOption: '',
          answer: '',
        },
        {
          id: 15,
          text: 'Packaging and carbonation preference:',
          type: 'carousel',
          options: [
            { text: 'Bottles', additionalInfo: 'Traditional packaging with individual servings.' },
            { text: 'Kegs', additionalInfo: 'Suitable for larger quantities and draft dispensing.' },
          ],
          selectedOption: '',
          answer: '',
        },
      ]);
      
    
    

    return (
        <div>
            <Toolbar>
            </Toolbar>
            <div className={styles.container}>
                <Head>
                    <title>Recipes</title>
                    <meta name="description" content="Generated by create next app" />
                    <link rel="icon" href="/avo.ico" />
                </Head>


                <main className={styles.main}>
                    <MultiStepForm questionList={brewingQuestions}></MultiStepForm>
                    <BigCarousel images={imageList}></BigCarousel>
                    {/* <Button onClick={() => console.log(recipes)}> show Recipes</Button> */}
                </main>

                <footer className={styles.footer}>
                    <a
                        href="https://vercel.com?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
                        target="_blank"
                        rel="noopener noreferrer"
                    >

                    </a>
                </footer>
            </div>
        </div>
    )
}
