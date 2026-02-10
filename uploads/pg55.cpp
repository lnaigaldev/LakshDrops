#include<iostream>
#include <cstring>
using namespace std;
int main(){
    char ch;
    ch=cin.get();
    cout<<ch<<endl;
    if(ch=='\n'){
        cout<<"You have entered a new line character"<<endl;
    }
    else if(ch==' '){
        cout<<"You have entered a space character"<<endl;
    }
    else{
        cout<<"You have entered a normal character"<<endl;
    }
}